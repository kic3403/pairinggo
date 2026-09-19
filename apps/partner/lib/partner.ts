/**
 * 파트너 계정·매장 데이터 — 가입 신청, 로그인 확인(실패 5회 → 15분 잠금), 내 매장 목록.
 */
import { db } from "@pairinggo/server/db";
import { hashPassword, passwordProblem, verifyPassword } from "@pairinggo/server/password";
import { merchantFromRow, type Merchant } from "@pairinggo/server/reservations";
import { MANUAL_PLACE_PREFIX, cleanMethods, duplicateMessage, normalizeMobile, sameIdentity, validatePartnerSignup, type Identity, type LoginMethod, type OAuthProfile, type OAuthProvider, type PartnerSignupInput } from "@pairinggo/shared";
import { randomBytes } from "node:crypto";
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

/**
 * 가입 신청 — 계정 + 매장(승인 대기) + 소유자 연결 + 예약 설정 기본값(받기 꺼짐).
 * social이 있으면 카카오·네이버로 가입: 비밀번호 없이(쓸 수 없는 표시 "oauth:…"), 그 계정을 바로 잇는다.
 */
export async function applyPartner(raw: PartnerSignupInput, place: PlacePick, social?: OAuthProfile | null): Promise<LoginResult> {
  const c = db();
  if (!c) return { ok: false, problem: "지금은 가입할 수 없어요" };
  const v = validatePartnerSignup(raw);
  if (!v.ok) return { ok: false, problem: v.problem };
  const s = v.value;
  const pwp = social ? null : passwordProblem(s.password);
  if (pwp) return { ok: false, problem: pwp };
  if (social) {
    const { data: taken } = await c.from("partner_identities").select("partner_user_id").eq("provider", social.provider).eq("provider_uid", social.uid).maybeSingle();
    if (taken) return { ok: false, problem: `이미 가입한 ${social.provider === "kakao" ? "카카오" : "네이버"} 계정이에요 — 로그인해 주세요` };
  }

  // 같은 사람 중복 가입 금지 — 이메일이 같거나 이름 + 휴대폰 번호가 같은 파트너 계정이 있으면(가입 방법 무관) 막는다
  // 직접 입력한 매장은 카카오 id가 없어 "manual-…" 표시 id를 만든다 — 같은 상호·주소로 이미 신청된 매장이 있으면 막는다
  const kakaoPlaceId = s.manualPlace ? `${MANUAL_PLACE_PREFIX}${randomBytes(6).toString("hex")}` : s.kakaoPlaceId;
  const esc = (v: string) => v.replace(/[\\%_]/g, (ch) => "\\" + ch);
  const [dup, { data: dupMerchant }] = await Promise.all([
    existingPartnerMethods({ email: s.email, name: s.name, phone: s.phone }),
    s.manualPlace
      ? c.from("merchants").select("id, status").ilike("name", esc(s.manualPlace.name)).ilike("address", esc(s.manualPlace.address)).limit(1).maybeSingle()
      : c.from("merchants").select("id, status").eq("kakao_place_id", s.kakaoPlaceId).maybeSingle(),
  ]);
  if (dup) return { ok: false, problem: duplicateMessage(dup, "partner") };
  if (dupMerchant) return { ok: false, problem: "이미 파트너 신청이 된 매장이에요 — 함께 쓰려면 운영자에게 문의해 주세요" };

  const passwordHash = social ? `oauth:${randomBytes(18).toString("base64url")}` : await hashPassword(s.password);
  const { data: user, error: ue } = await c.from("partner_users").insert({ email: s.email, password_hash: passwordHash, name: s.name, phone: s.phone }).select("id").single();
  if (ue || !user) return { ok: false, problem: "가입을 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  const { data: m, error: me } = await c.from("merchants").insert({
    kakao_place_id: kakaoPlaceId, name: place.name.slice(0, 80), address: place.address.slice(0, 200), phone: place.phone.slice(0, 20),
    lat: place.lat, lng: place.lng, place_url: place.placeUrl, owner_name: s.ownerName, biz_no: s.bizNo, status: "applied",
  }).select("id").single();
  if (me || !m) {
    await c.from("partner_users").delete().eq("id", user.id);
    return { ok: false, problem: me?.code === "23505" ? "이미 파트너 신청이 된 매장이에요" : "매장을 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  }
  await c.from("merchant_members").insert({ merchant_id: m.id, partner_user_id: user.id, role: "owner" });
  if (social) await c.from("partner_identities").insert({ provider: social.provider, provider_uid: social.uid, partner_user_id: user.id, email: social.email, last_login_at: new Date().toISOString() });
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

/**
 * 같은 사람이 이미 가입한 파트너 계정의 가입 방법들(이메일·카카오·네이버) — 없으면 null.
 * 이메일이 같거나, 이름 + 휴대폰 번호가 같은 계정(shared sameIdentity). 비밀번호가 있으면 "이메일", 연결된 간편로그인은 그 공급자.
 */
export async function existingPartnerMethods(who: Identity): Promise<LoginMethod[] | null> {
  const c = db();
  if (!c) return null;
  const email = String(who.email ?? "").trim().toLowerCase();
  const phone = who.phone ? normalizeMobile(who.phone) : null;
  const cols = "id, email, name, phone, password_hash";
  const [byEmail, byPhone] = await Promise.all([
    email ? c.from("partner_users").select(cols).eq("email", email).limit(5) : Promise.resolve({ data: [] }),
    phone ? c.from("partner_users").select(cols).eq("phone", phone).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const rows = [...(byEmail.data ?? []), ...(byPhone.data ?? [])] as { id: string; email: string; name: string | null; phone: string | null; password_hash: string }[];
  const hits = rows.filter((r) => sameIdentity(who, r) != null);
  if (!hits.length) return null;
  const { data: ids } = await c.from("partner_identities").select("provider").in("partner_user_id", [...new Set(hits.map((r) => r.id))]);
  const methods = [...(hits.some((r) => !String(r.password_hash).startsWith("oauth:")) ? ["email"] : []), ...(ids ?? []).map((r) => String(r.provider))];
  return cleanMethods(methods);
}

/* ---------- 간편로그인(카카오·네이버) 연결 ---------- */
/** 연결된 파트너 — 로그인 쿠키를 만들 비밀번호 해시까지 */
export async function partnerByIdentity(p: OAuthProvider, uid: string): Promise<{ id: string; passwordHash: string } | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.from("partner_identities").select("partner_user_id, partner_users(id, password_hash)").eq("provider", p).eq("provider_uid", uid).maybeSingle();
  const u = data?.partner_users as unknown as { id: string; password_hash: string } | null;
  if (!u) return null;
  await c.from("partner_identities").update({ last_login_at: new Date().toISOString() }).eq("provider", p).eq("provider_uid", uid);
  await c.from("partner_users").update({ last_login_at: new Date().toISOString() }).eq("id", u.id);
  return { id: String(u.id), passwordHash: String(u.password_hash) };
}

export async function linkIdentity(userId: string, prof: OAuthProfile): Promise<"linked" | "taken" | "already"> {
  const c = db()!;
  const { data: other } = await c.from("partner_identities").select("partner_user_id").eq("provider", prof.provider).eq("provider_uid", prof.uid).maybeSingle();
  if (other) return other.partner_user_id === userId ? "already" : "taken";
  const { data: mine } = await c.from("partner_identities").select("provider_uid").eq("partner_user_id", userId).eq("provider", prof.provider).maybeSingle();
  if (mine) return "already";
  const { error } = await c.from("partner_identities").insert({ provider: prof.provider, provider_uid: prof.uid, partner_user_id: userId, email: prof.email });
  return error ? "taken" : "linked";
}

export async function unlinkIdentity(userId: string, p: OAuthProvider): Promise<{ ok: boolean; problem?: string }> {
  const c = db()!;
  // 비밀번호가 없는 계정은 마지막 로그인 방법을 끊지 않게
  const [{ data: u }, { count }] = await Promise.all([
    c.from("partner_users").select("password_hash").eq("id", userId).single(),
    c.from("partner_identities").select("provider", { count: "exact", head: true }).eq("partner_user_id", userId),
  ]);
  if (String(u?.password_hash ?? "").startsWith("oauth:") && (count ?? 0) <= 1) return { ok: false, problem: "로그인할 다른 방법이 없어요 — 먼저 비밀번호를 만들어 주세요(비밀번호 찾기)" };
  await c.from("partner_identities").delete().eq("partner_user_id", userId).eq("provider", p);
  return { ok: true };
}

export async function linkedProviders(userId: string): Promise<{ providers: OAuthProvider[]; hasPassword: boolean }> {
  const c = db();
  if (!c) return { providers: [], hasPassword: true };
  const [{ data: ids }, { data: u }] = await Promise.all([
    c.from("partner_identities").select("provider").eq("partner_user_id", userId),
    c.from("partner_users").select("password_hash").eq("id", userId).maybeSingle(),
  ]);
  return { providers: (ids ?? []).map((r) => r.provider as OAuthProvider), hasPassword: !String(u?.password_hash ?? "").startsWith("oauth:") };
}
