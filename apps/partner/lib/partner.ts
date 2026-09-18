/**
 * 파트너 계정·매장 데이터 — 가입 신청, 로그인 확인(실패 5회 → 15분 잠금), 내 매장 목록.
 */
import { db } from "@pairinggo/server/db";
import { hashPassword, passwordProblem, verifyPassword } from "@pairinggo/server/password";
import { merchantFromRow, type Merchant } from "@pairinggo/server/reservations";
import { validatePartnerSignup, type PartnerSignupInput } from "@pairinggo/shared";
import { redirect } from "next/navigation";
import { currentPartner, requirePartner, type PartnerUser } from "./session";

export const LOGIN_MAX_FAILS = 5, LOCK_MINUTES = 15;

export type MyMerchant = Merchant & { role: "owner" | "staff"; rejectReason: string; ownerName: string; bizNo: string; createdAt: string };

export async function myMerchants(partnerUserId: string): Promise<MyMerchant[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("merchant_members")
    .select("role, merchants(id, kakao_place_id, name, address, phone, lat, lng, place_url, status, reject_reason, owner_name, biz_no, created_at)")
    .eq("partner_user_id", partnerUserId);
  return (data ?? []).flatMap((r) => {
    const m = r.merchants as unknown as Record<string, unknown> | null;
    return m ? [{ ...merchantFromRow(m), role: r.role as "owner" | "staff", rejectReason: String(m.reject_reason ?? ""), ownerName: String(m.owner_name ?? ""), bizNo: String(m.biz_no ?? ""), createdAt: String(m.created_at ?? "") }] : [];
  });
}

export type LoginResult = { ok: true; id: string; passwordHash: string } | { ok: false; problem: string };

export async function checkLogin(emailRaw: string, password: string): Promise<LoginResult> {
  const c = db();
  if (!c) return { ok: false, problem: "지금은 로그인할 수 없어요" };
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const { data: u } = await c.from("partner_users").select("id, password_hash, failed_logins, locked_until").eq("email", email).maybeSingle();
  const wrong = { ok: false as const, problem: "이메일 또는 비밀번호가 맞지 않아요" };
  if (!u) { await verifyPassword(password, null); return wrong; }
  if (u.locked_until && new Date(String(u.locked_until)).getTime() > Date.now()) {
    return { ok: false, problem: `로그인을 ${LOGIN_MAX_FAILS}번 틀려 잠시 잠겼어요 — ${LOCK_MINUTES}분 뒤에 다시 시도해 주세요` };
  }
  if (!(await verifyPassword(password, String(u.password_hash)))) {
    const fails = Number(u.failed_logins ?? 0) + 1;
    const lock = fails >= LOGIN_MAX_FAILS;
    await c.from("partner_users").update({ failed_logins: lock ? 0 : fails, locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null }).eq("id", u.id);
    return wrong;
  }
  await c.from("partner_users").update({ failed_logins: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq("id", u.id);
  return { ok: true, id: String(u.id), passwordHash: String(u.password_hash) };
}

export type PlacePick = { name: string; address: string; phone: string; lat: number | null; lng: number | null; placeUrl: string | null };

/** 가입 신청 — 계정 + 매장(승인 대기) + 소유자 연결 + 예약 설정 기본값(받기 꺼짐) */
export async function applyPartner(raw: PartnerSignupInput, place: PlacePick): Promise<LoginResult> {
  const c = db();
  if (!c) return { ok: false, problem: "지금은 가입할 수 없어요" };
  const v = validatePartnerSignup(raw);
  if (!v.ok) return { ok: false, problem: v.problem };
  const s = v.value;
  const pwp = passwordProblem(s.password);
  if (pwp) return { ok: false, problem: pwp };

  const [{ data: dupUser }, { data: dupMerchant }] = await Promise.all([
    c.from("partner_users").select("id").eq("email", s.email).maybeSingle(),
    c.from("merchants").select("id, status").eq("kakao_place_id", s.kakaoPlaceId).maybeSingle(),
  ]);
  if (dupUser) return { ok: false, problem: "이미 가입한 이메일이에요 — 로그인해 주세요" };
  if (dupMerchant) return { ok: false, problem: "이미 파트너 신청이 된 매장이에요 — 함께 쓰려면 운영자에게 문의해 주세요" };

  const passwordHash = await hashPassword(s.password);
  const { data: user, error: ue } = await c.from("partner_users").insert({ email: s.email, password_hash: passwordHash, name: s.name, phone: s.phone }).select("id").single();
  if (ue || !user) return { ok: false, problem: "가입을 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  const { data: m, error: me } = await c.from("merchants").insert({
    kakao_place_id: s.kakaoPlaceId, name: place.name.slice(0, 80), address: place.address.slice(0, 200), phone: place.phone.slice(0, 20),
    lat: place.lat, lng: place.lng, place_url: place.placeUrl, owner_name: s.ownerName, biz_no: s.bizNo, status: "applied",
  }).select("id").single();
  if (me || !m) {
    await c.from("partner_users").delete().eq("id", user.id);
    return { ok: false, problem: me?.code === "23505" ? "이미 파트너 신청이 된 매장이에요" : "매장을 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  }
  await c.from("merchant_members").insert({ merchant_id: m.id, partner_user_id: user.id, role: "owner" });
  await c.from("reservation_settings").insert({ merchant_id: m.id, accepting: false });
  return { ok: true, id: String(user.id), passwordHash };
}

/** 승인된 내 매장 — 페이지: 없으면 홈(상태 안내)으로 */
export async function requireApprovedMerchant(): Promise<{ user: PartnerUser; merchant: MyMerchant }> {
  const user = await requirePartner();
  const merchant = (await myMerchants(user.id)).find((m) => m.status === "approved");
  if (!merchant) redirect("/");
  return { user, merchant };
}

/** 승인된 내 매장 — API: 로그인 안 했으면 401, 승인 매장이 없으면 403 */
export async function approvedOrError(): Promise<{ user: PartnerUser; merchant: MyMerchant } | Response> {
  const user = await currentPartner();
  if (!user) return Response.json({ error: "다시 로그인해 주세요" }, { status: 401 });
  const merchant = (await myMerchants(user.id)).find((m) => m.status === "approved");
  if (!merchant) return Response.json({ error: "승인된 매장이 없어요" }, { status: 403 });
  return { user, merchant };
}
