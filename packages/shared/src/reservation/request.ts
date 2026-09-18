/**
 * 손님 예약 요청 검증 — 화면과 서버 API가 같은 규칙을 쓴다(최종 정원 판정은 DB 함수).
 */
import { isDate } from "./time";
import type { DayAvailability, ReservationSettings } from "./slots";

export const RESERVATION_NOTE_MAX = 200, GUEST_NAME_MAX = 20;

export type ReservationRequestInput = {
  date: string; time: string; partySize: number;
  guestName: string;
  note?: string;
  roomRequested?: boolean;
  bringOwnDrink?: boolean;
  /** 페어링GO에서 고른 조합(술·음식 id) — 매장 화면에 "이 조합으로 오세요"로 보인다 */
  drinkId?: string | null; foodId?: string | null;
  /** 이번 예약 정보를 매장에 제공하는 데 동의(예약마다) */
  shareConsent: boolean;
};

export type CleanRequest = Required<Omit<ReservationRequestInput, "drinkId" | "foodId">> & { drinkId: string | null; foodId: string | null };

const hasLink = (s: string) => /https?:|www\.|\.(com|kr|net)\b/i.test(s);

/** 문제가 없으면 정리된 요청, 있으면 한국어 안내 한 줄 */
export function validateReservationRequest(raw: ReservationRequestInput, settings: ReservationSettings, day: DayAvailability): { ok: true; value: CleanRequest } | { ok: false; problem: string } {
  const no = (problem: string) => ({ ok: false as const, problem });
  if (!isDate(raw.date) || !/^\d{2}:\d{2}$/.test(raw.time)) return no("날짜와 시간을 골라 주세요");
  const party = Math.round(Number(raw.partySize));
  if (!Number.isFinite(party) || party < settings.minParty || party > settings.maxParty) return no(`인원은 ${settings.minParty}~${settings.maxParty}명 사이로 골라 주세요`);
  if (day.date !== raw.date || day.reason !== "ok") return no(day.reason === "closed" ? "그날은 쉬는 날이에요" : day.reason === "not_accepting" ? "지금은 예약을 받지 않아요" : "예약할 수 없는 날짜예요");
  const slot = day.slots.find((s) => s.time === raw.time);
  if (!slot) return no("예약할 수 없는 시간이에요");
  if (slot.remainingParties <= 0 || (slot.remainingPeople !== null && slot.remainingPeople < party)) return no("그 시간은 자리가 없어요 — 다른 시간을 골라 주세요");
  const guestName = String(raw.guestName ?? "").replace(/\s+/g, " ").trim();
  if (!guestName || guestName.length > GUEST_NAME_MAX) return no("예약자 이름을 적어 주세요(20자 이내)");
  const note = String(raw.note ?? "").replace(/\s+/g, " ").trim();
  if (note.length > RESERVATION_NOTE_MAX) return no(`요청사항은 ${RESERVATION_NOTE_MAX}자까지예요`);
  if (hasLink(note) || hasLink(guestName)) return no("링크는 적을 수 없어요");
  if (raw.shareConsent !== true) return no("예약 정보를 매장에 전달하는 데 동의해 주세요");
  const id = (v: unknown, p: "d" | "f") => (typeof v === "string" && new RegExp(`^${p}\\d+$`).test(v) ? v : null);
  return {
    ok: true,
    value: {
      date: raw.date, time: raw.time, partySize: party, guestName, note,
      roomRequested: settings.roomBookable && raw.roomRequested === true,
      bringOwnDrink: raw.bringOwnDrink === true,
      drinkId: id(raw.drinkId, "d"), foodId: id(raw.foodId, "f"), shareConsent: true,
    },
  };
}

/** DB 함수 reserve()·reservation_transition()이 돌려주는 오류 코드 → 화면 안내 */
export const RESERVE_ERROR_MESSAGE: Record<string, string> = {
  not_accepting: "지금은 예약을 받지 않는 매장이에요",
  merchant_unavailable: "예약할 수 없는 매장이에요",
  party_range: "인원을 다시 골라 주세요",
  past: "지난 시간은 예약할 수 없어요",
  full: "방금 그 시간이 마감됐어요 — 다른 시간을 골라 주세요",
  duplicate: "같은 날 이 매장에 이미 예약이 있어요 — 내 예약에서 확인해 주세요",
  too_many: "앞으로 잡힌 예약이 5건이에요 — 방문한 뒤에 더 예약할 수 있어요",
  not_found: "예약을 찾을 수 없어요",
  forbidden: "이 예약을 바꿀 권한이 없어요",
  same_status: "이미 그 상태예요",
  final: "이미 끝난 예약이에요",
  not_allowed: "지금 상태에서는 바꿀 수 없어요",
  too_early: "아직 처리할 수 있는 시간이 아니에요",
  too_late: "방문 1시간 전이 지나 앱에서 취소할 수 없어요 — 매장에 전화해 주세요",
  reason_required: "취소 사유를 적어 주세요",
};
export const reserveErrorMessage = (code?: string | null) => (code && RESERVE_ERROR_MESSAGE[code]) || "잠시 뒤 다시 시도해 주세요";

/** 페어링을 들고 들어온 요청사항 초안 — "해물파전 × 한산소곡주 페어링으로 방문해요" */
export function pairingNoteDraft(foodName?: string | null, drinkName?: string | null, bringOwnDrink?: boolean): string {
  const pair = [foodName, drinkName].filter(Boolean).join(" × ");
  const parts = [pair ? `${pair} 페어링으로 방문해요` : "", bringOwnDrink && drinkName ? `${drinkName}은(는) 가져갈게요(콜키지)` : ""].filter(Boolean);
  return parts.join(". ").slice(0, RESERVATION_NOTE_MAX);
}
