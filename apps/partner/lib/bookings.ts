/**
 * 파트너 화면용 예약 — 날짜별 목록, 상태 요약, 지금 누를 수 있는 버튼.
 * 손님 번호는 방문일로부터 90일이 지나면 가린다(파트너 이용약관 6조, 개인정보처리방침 4번).
 */
import { addDays, formatMobile, kstParts, maskMobile, STATUS_LABEL, storeActions, type ReservationStatus } from "@pairinggo/shared";
import { reservationsForMerchant } from "@pairinggo/server/reservations";
import { catalogNames } from "@pairinggo/server/merchant-store";

export const PHONE_VISIBLE_DAYS = 90;

export type Booking = {
  id: string; code: string; date: string; time: string; visitAt: string; partySize: number;
  guestName: string; phone: string | null; phoneMasked: string; status: ReservationStatus; statusLabel: string;
  note: string; roomRequested: boolean; bringOwnDrink: boolean; pairing: string | null; cancelReason: string;
  actions: ReservationStatus[];
};

export async function bookings(merchantId: string, from: string, to: string): Promise<Booking[]> {
  const [rows, cat] = await Promise.all([reservationsForMerchant(merchantId, from, to), catalogNames()]);
  const DN = new Map(cat.drinks.map((d) => [d.id, d.name])), FN = new Map(cat.foods.map((f) => [f.id, f.name]));
  const now = new Date();
  const hideBefore = addDays(kstParts(now).date, -PHONE_VISIBLE_DAYS);
  return rows.map((r) => {
    const visible = r.date >= hideBefore && !!r.guestPhone;
    const pair = [r.foodId ? FN.get(r.foodId) : null, r.drinkId ? DN.get(r.drinkId) : null].filter(Boolean).join(" × ");
    return {
      id: r.id, code: r.code, date: r.date, time: r.time, visitAt: r.visitAt, partySize: r.partySize,
      guestName: r.guestName, phone: visible ? formatMobile(r.guestPhone) : null, phoneMasked: r.guestPhone ? maskMobile(r.guestPhone) : "",
      status: r.status, statusLabel: STATUS_LABEL[r.status], note: r.note, roomRequested: r.roomRequested, bringOwnDrink: r.bringOwnDrink,
      pairing: pair || null, cancelReason: r.cancelReason, actions: storeActions(r.status, now, new Date(r.visitAt)),
    };
  });
}

export type DaySummary = { parties: number; people: number; seated: number; completed: number; noShow: number; cancelled: number };
export function summarize(list: Booking[]): DaySummary {
  const live = list.filter((b) => b.status === "confirmed" || b.status === "seated" || b.status === "completed");
  return {
    parties: live.length, people: live.reduce((s, b) => s + b.partySize, 0),
    seated: list.filter((b) => b.status === "seated").length, completed: list.filter((b) => b.status === "completed").length,
    noShow: list.filter((b) => b.status === "no_show").length, cancelled: list.filter((b) => b.status.startsWith("cancelled")).length,
  };
}
