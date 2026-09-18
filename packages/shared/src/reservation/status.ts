/**
 * 예약 상태와 전이 규칙(2026-09-18 사용자 결정: 즉시 확정 — 사장님 수락 단계 없음).
 *   확정 ─(도착)→ 착석 ─→ 완료
 *    ├─(손님, 방문 USER_CANCEL_CUTOFF_MIN분 전까지)→ 손님 취소
 *    ├─(매장, 사유 필수)→ 매장 취소
 *    └─(방문 NO_SHOW_AFTER_MIN분 뒤부터)→ 노쇼
 * 화면(버튼 켜기/끄기)과 서버(API)가 같은 함수를 쓰고, DB 함수 reservation_transition이 한 번 더 막는다.
 */
export const RESERVATION_STATUSES = ["confirmed", "seated", "completed", "no_show", "cancelled_by_user", "cancelled_by_store"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export type ReservationActor = "user" | "store" | "admin" | "system";

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmed: "예약 확정", seated: "착석", completed: "방문 완료", no_show: "노쇼", cancelled_by_user: "손님 취소", cancelled_by_store: "매장 취소",
};

/** 정원 계산에 들어가는 상태 — 확정·착석 */
export const CAPACITY_STATUSES: readonly ReservationStatus[] = ["confirmed", "seated"];
export const countsTowardCapacity = (s: ReservationStatus) => CAPACITY_STATUSES.includes(s);
export const isFinalStatus = (s: ReservationStatus) => !CAPACITY_STATUSES.includes(s);

/** 손님이 앱에서 취소할 수 있는 마지막 순간(방문 N분 전) · 노쇼 처리 가능 시작(방문 N분 뒤) · 착석 처리 가능 시작(방문 N분 전) */
export const USER_CANCEL_CUTOFF_MIN = 60, NO_SHOW_AFTER_MIN = 15, SEAT_EARLY_MIN = 120;
export const CANCEL_REASON_MAX = 100;

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

const MIN = 60_000;

/** from → to 를 actor가 지금(now) 할 수 있는가. visitAt = 방문 순간 */
export function canTransition(from: ReservationStatus, to: ReservationStatus, actor: ReservationActor, now: Date, visitAt: Date, note?: string | null): TransitionCheck {
  const no = (reason: string): TransitionCheck => ({ ok: false, reason });
  if (from === to) return no("이미 그 상태예요");
  if (isFinalStatus(from)) return no(`이미 '${STATUS_LABEL[from]}' 처리된 예약이에요`);
  const t = now.getTime(), v = visitAt.getTime();
  const staff = actor === "store" || actor === "admin";

  switch (to) {
    case "seated":
      if (from !== "confirmed") return no("확정된 예약만 착석 처리할 수 있어요");
      if (!staff) return no("매장에서만 처리할 수 있어요");
      if (t < v - SEAT_EARLY_MIN * MIN) return no("방문 2시간 전부터 착석 처리할 수 있어요");
      return { ok: true };
    case "completed":
      if (!staff) return no("매장에서만 처리할 수 있어요");
      if (t < v - SEAT_EARLY_MIN * MIN) return no("방문 시간이 가까워지면 처리할 수 있어요");
      return { ok: true };
    case "no_show":
      if (from !== "confirmed") return no("착석한 손님은 노쇼로 바꿀 수 없어요");
      if (!staff) return no("매장에서만 처리할 수 있어요");
      if (t < v + NO_SHOW_AFTER_MIN * MIN) return no(`방문 시간 ${NO_SHOW_AFTER_MIN}분 뒤부터 노쇼 처리할 수 있어요`);
      return { ok: true };
    case "cancelled_by_user":
      if (from !== "confirmed") return no("착석 뒤에는 취소할 수 없어요");
      if (actor === "admin") return { ok: true };
      if (actor !== "user") return no("손님만 취소할 수 있어요");
      if (t > v - USER_CANCEL_CUTOFF_MIN * MIN) return no(`방문 ${USER_CANCEL_CUTOFF_MIN}분 전까지만 앱에서 취소할 수 있어요 — 매장에 전화해 주세요`);
      return { ok: true };
    case "cancelled_by_store":
      if (from !== "confirmed") return no("착석 뒤에는 취소할 수 없어요");
      if (!staff) return no("매장에서만 처리할 수 있어요");
      if (!String(note ?? "").trim()) return no("취소 사유를 적어 주세요");
      return { ok: true };
    default:
      return no("바꿀 수 없는 상태예요");
  }
}

/** 지금 이 예약에 보여 줄 수 있는 매장 버튼 */
export function storeActions(status: ReservationStatus, now: Date, visitAt: Date): ReservationStatus[] {
  return (["seated", "completed", "no_show", "cancelled_by_store"] as const).filter((to) => {
    const r = canTransition(status, to, "store", now, visitAt, "사유");
    return r.ok;
  });
}
