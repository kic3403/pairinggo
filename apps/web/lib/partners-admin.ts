/**
 * 어드민 — 파트너(식당) 신청 승인·반려·정지(2026-09-18 사용자 결정: 가입은 신청 → 운영자 승인).
 * 승인해도 예약 받기는 꺼진 채로 시작한다 — 사장님이 파트너 앱에서 영업시간·정원을 정하고 켠다.
 */
import { db } from "@/lib/db";
import type { MerchantStatus } from "@pairinggo/server/reservations";

export type AdminMerchant = {
  id: string; kakaoPlaceId: string; name: string; address: string; phone: string; placeUrl: string | null;
  ownerName: string; bizNo: string; status: MerchantStatus; rejectReason: string; createdAt: string; approvedAt: string | null;
  accepting: boolean; members: { name: string; email: string; phone: string; role: string }[];
};

export async function listMerchants(): Promise<AdminMerchant[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("merchants")
    .select("id, kakao_place_id, name, address, phone, place_url, owner_name, biz_no, status, reject_reason, created_at, approved_at, reservation_settings(accepting), merchant_members(role, partner_users(name, email, phone))")
    .order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const s = r.reservation_settings as unknown as { accepting?: boolean } | { accepting?: boolean }[] | null;
    const members = (r.merchant_members as unknown as { role: string; partner_users: { name: string; email: string; phone: string } | null }[] | null) ?? [];
    return {
      id: r.id, kakaoPlaceId: r.kakao_place_id, name: r.name, address: r.address, phone: r.phone, placeUrl: r.place_url,
      ownerName: r.owner_name, bizNo: r.biz_no, status: r.status, rejectReason: r.reject_reason, createdAt: r.created_at, approvedAt: r.approved_at,
      accepting: Array.isArray(s) ? s[0]?.accepting === true : s?.accepting === true,
      members: members.flatMap((m) => (m.partner_users ? [{ ...m.partner_users, role: m.role }] : [])),
    };
  });
}

export type MerchantAction = "approve" | "reject" | "suspend" | "resume";
const NEXT: Record<MerchantAction, { from: MerchantStatus[]; to: MerchantStatus; needsReason: boolean }> = {
  approve: { from: ["applied", "rejected"], to: "approved", needsReason: false },
  reject: { from: ["applied"], to: "rejected", needsReason: true },
  suspend: { from: ["approved"], to: "suspended", needsReason: true },
  resume: { from: ["suspended"], to: "approved", needsReason: false },
};

export async function actOnMerchant(id: string, action: MerchantAction, reason: string): Promise<void> {
  const c = db();
  if (!c) throw new Error("DB가 연결되지 않았어요");
  const rule = NEXT[action];
  if (!rule) throw new Error("알 수 없는 처리예요");
  const why = String(reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (rule.needsReason && !why) throw new Error("사유를 적어 주세요 — 사장님 화면에 보여요");
  const { data: m } = await c.from("merchants").select("status").eq("id", id).maybeSingle();
  if (!m) throw new Error("매장을 찾을 수 없어요");
  if (!rule.from.includes(m.status as MerchantStatus)) throw new Error(`지금 상태(${m.status})에서는 할 수 없어요`);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: rule.to, reject_reason: rule.needsReason ? why : "", updated_at: now };
  if (action === "approve") { patch.approved_at = now; patch.approved_by = "admin"; }
  const { error } = await c.from("merchants").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  // 정지하면 새 예약이 들어오지 않게 예약 받기도 끈다(이미 잡힌 예약은 그대로 — 필요하면 매장이 취소)
  if (action === "suspend") await c.from("reservation_settings").update({ accepting: false, updated_at: now }).eq("merchant_id", id);
}

type AnyRow = Record<string, unknown> | null | undefined;
const SETTING_LABEL: Record<string, string> = {
  accepting: "예약 받기", slot_minutes: "간격", capacity_parties: "최대 팀", capacity_people: "최대 인원", min_party: "최소 인원", max_party: "최대 인원",
  lead_minutes: "당일 마감", horizon_days: "받는 기간", room_bookable: "룸 희망", notice: "안내 문구",
};
const INFO_LABEL: Record<string, string> = {
  menu_note: "소개", parking: "주차", parking_note: "주차 메모", corkage: "콜키지", corkage_note: "콜키지 메모", room: "룸", room_note: "룸 메모",
  drink_ids: "술", drink_names: "술", food_ids: "메뉴", menu_names: "메뉴", naver_url: "네이버 링크",
};
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const show = (v: unknown) => (typeof v === "boolean" ? (v ? "켬" : "끔") : v == null || v === "" ? "없음" : String(v));

/** 변경 한 줄 요약 — 무엇이 어떻게 바뀌었는지 */
export function summarizeChange(section: string, before: unknown, after: unknown): string {
  if (section === "settings") {
    const b = (before ?? {}) as Record<string, unknown>, a = (after ?? {}) as Record<string, unknown>;
    const d = Object.keys(SETTING_LABEL).filter((k) => !same(b[k], a[k])).map((k) => `${SETTING_LABEL[k]} ${show(b[k])}→${show(a[k])}`);
    return d.join(", ") || "바뀐 값 없음";
  }
  if (section === "hours") {
    const key = (r: AnyRow) => (r ? (r.closed ? "휴무" : `${r.open}~${r.close}${r.break_start ? ` (쉼 ${r.break_start}~${r.break_end})` : ""}`) : "없음");
    const W = "일월화수목금토";
    const b = new Map(((before as AnyRow[]) ?? []).map((r) => [Number(r?.weekday), key(r)])), a = new Map(((after as AnyRow[]) ?? []).map((r) => [Number(r?.weekday), key(r)]));
    const d = [1, 2, 3, 4, 5, 6, 0].filter((w) => b.get(w) !== a.get(w)).map((w) => `${W[w]} ${a.get(w) ?? "없음"}`);
    return d.join(", ") || "바뀐 요일 없음";
  }
  if (section === "closures") {
    const days = (x: unknown) => new Set(((x as { day: string }[]) ?? []).map((r) => r.day));
    const b = days(before), a = days(after);
    const add = [...a].filter((d) => !b.has(d)), rm = [...b].filter((d) => !a.has(d));
    return [add.length ? `휴무 추가 ${add.join(", ")}` : "", rm.length ? `휴무 해제 ${rm.join(", ")}` : ""].filter(Boolean).join(" · ") || "바뀐 날짜 없음";
  }
  if (section === "info") {
    const b = (before ?? {}) as { phone?: string; place?: AnyRow }, a = (after ?? {}) as { phone?: string; place?: AnyRow };
    const out: string[] = [];
    if (b.phone !== undefined && a.phone !== undefined && b.phone !== a.phone) out.push(`대표 번호 ${show(b.phone)}→${show(a.phone)}`);
    if (!b.place && a.place) out.push("매장 정보 처음 입력");
    else if (b.place && !a.place) out.push("매장 정보 모두 지움");
    else if (b.place && a.place) {
      const labels = new Set(Object.keys(INFO_LABEL).filter((k) => !same(b.place![k], a.place![k])).map((k) => INFO_LABEL[k]));
      if (labels.size) out.push(`${[...labels].join("·")} 수정`);
    }
    return out.join(", ") || "바뀐 값 없음";
  }
  return "";
}
