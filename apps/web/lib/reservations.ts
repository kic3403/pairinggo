/**
 * 손님(페어링GO) 쪽 예약 — 예약 화면 데이터, 내 예약 목록, 취소. 저장·정원은 @pairinggo/server/reservations(DB 함수).
 * 매장 쪽 메모(store_memo)는 손님에게 내려 주지 않는다.
 */
import { canTransition, CONSENT_VERSION, STATUS_LABEL, type BusinessHours, type PlaceInfo, type ReservationSettings, type ReservationStatus } from "@pairinggo/shared";
import { bookingContextByKakao, isBookable, reservationsForUser, type Reservation } from "@pairinggo/server/reservations";
import { getStoreInfo } from "@pairinggo/server/merchant-store";
import { db } from "./db";
import { getCatalog } from "./catalog";

export type ReservePageData = {
  kakaoId: string; name: string; address: string; phone: string; bookable: boolean;
  settings: Pick<ReservationSettings, "minParty" | "maxParty" | "horizonDays" | "leadMinutes" | "roomBookable" | "notice" | "slotMinutes">;
  hours: BusinessHours[]; closures: string[]; info: PlaceInfo | null;
};

export async function reservePageData(kakaoId: string): Promise<ReservePageData | null> {
  const ctx = await bookingContextByKakao(kakaoId);
  if (!ctx || ctx.merchant.status !== "approved") return null;
  const { info } = await getStoreInfo(ctx.merchant);
  const s = ctx.settings;
  return {
    kakaoId, name: ctx.merchant.name, address: ctx.merchant.address, phone: ctx.merchant.phone, bookable: isBookable(ctx),
    settings: { minParty: s.minParty, maxParty: s.maxParty, horizonDays: s.horizonDays, leadMinutes: s.leadMinutes, roomBookable: s.roomBookable, notice: s.notice, slotMinutes: s.slotMinutes },
    hours: ctx.hours, closures: ctx.closures, info,
  };
}

export type MyReservation = {
  id: string; code: string; date: string; time: string; visitAt: string; partySize: number; status: ReservationStatus; statusLabel: string;
  storeName: string; storeAddress: string; storePhone: string; kakaoId: string; note: string; cancelReason: string;
  drink: string | null; food: string | null; roomRequested: boolean; bringOwnDrink: boolean; canCancel: boolean; cancelBlockedReason: string | null;
};

export async function myReservations(userId: string): Promise<MyReservation[]> {
  const [rows, c] = await Promise.all([reservationsForUser(userId), getCatalog()]);
  const DN = new Map(c.dataset.drinks.map((d) => [d.id, d.name])), FN = new Map(c.dataset.foods.map((f) => [f.id, f.name]));
  const now = new Date();
  return rows.map((r: Reservation) => {
    const chk = r.status === "confirmed" ? canTransition(r.status, "cancelled_by_user", "user", now, new Date(r.visitAt)) : null;
    return {
      id: r.id, code: r.code, date: r.date, time: r.time, visitAt: r.visitAt, partySize: r.partySize, status: r.status, statusLabel: STATUS_LABEL[r.status],
      storeName: r.merchant?.name ?? "", storeAddress: r.merchant?.address ?? "", storePhone: r.merchant?.phone ?? "", kakaoId: r.merchant?.kakaoPlaceId ?? "",
      note: r.note, cancelReason: r.cancelReason, drink: r.drinkId ? DN.get(r.drinkId) ?? null : null, food: r.foodId ? FN.get(r.foodId) ?? null : null,
      roomRequested: r.roomRequested, bringOwnDrink: r.bringOwnDrink,
      canCancel: !!chk?.ok, cancelBlockedReason: chk && !chk.ok ? chk.reason : null,
    };
  });
}

/** 예약하려는 회원의 상태 — 번호 인증·최신 약관 동의 */
export async function reserverState(userId: string): Promise<{ phone: string | null; verified: boolean; consentOk: boolean }> {
  const c = db();
  if (!c) return { phone: null, verified: false, consentOk: false };
  const { data } = await c.from("users").select("phone, phone_verified_at, consent_version").eq("id", userId).maybeSingle();
  return { phone: (data?.phone as string) ?? null, verified: !!data?.phone_verified_at, consentOk: data?.consent_version === CONSENT_VERSION };
}
