/**
 * 예약 저장·조회 — 페어링GO(손님)와 파트너 앱(매장)이 함께 쓴다.
 * 규칙은 @pairinggo/shared reservation, 정원·전이의 최종 판정은 DB 함수 reserve()·reservation_transition()(0023).
 */
import {
  availableSlots, cleanHours, DEFAULT_SETTINGS, reserveErrorMessage, validateReservationRequest,
  type BookedSlot, type BusinessHours, type DayAvailability, type ReservationActor, type ReservationRequestInput,
  type ReservationSettings, type ReservationStatus,
} from "@pairinggo/shared";
import { db } from "./db";

export type MerchantStatus = "applied" | "approved" | "rejected" | "suspended";
export type Merchant = {
  id: string; kakaoPlaceId: string; name: string; address: string; phone: string;
  lat: number | null; lng: number | null; placeUrl: string | null; status: MerchantStatus;
};
export type BookingContext = { merchant: Merchant; settings: ReservationSettings; hours: BusinessHours[]; closures: string[] };

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));

export const merchantFromRow = (r: Row): Merchant => ({
  id: str(r.id), kakaoPlaceId: str(r.kakao_place_id), name: str(r.name), address: str(r.address), phone: str(r.phone),
  lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng), placeUrl: (r.place_url as string) ?? null,
  status: str(r.status) as MerchantStatus,
});

export const settingsFromRow = (r: Row | null | undefined): ReservationSettings => (r ? {
  accepting: r.accepting === true, slotMinutes: Number(r.slot_minutes), capacityParties: Number(r.capacity_parties), capacityPeople: Number(r.capacity_people),
  minParty: Number(r.min_party), maxParty: Number(r.max_party), leadMinutes: Number(r.lead_minutes), horizonDays: Number(r.horizon_days),
  roomBookable: r.room_bookable === true, notice: str(r.notice),
} : { ...DEFAULT_SETTINGS });

export const settingsToRow = (merchantId: string, s: ReservationSettings) => ({
  merchant_id: merchantId, accepting: s.accepting, slot_minutes: s.slotMinutes, capacity_parties: s.capacityParties, capacity_people: s.capacityPeople,
  min_party: s.minParty, max_party: s.maxParty, lead_minutes: s.leadMinutes, horizon_days: s.horizonDays, room_bookable: s.roomBookable, notice: s.notice,
  updated_at: new Date().toISOString(),
});

/** 영업시간 행 → 요일 7개(없는 요일은 휴무) */
export const hoursFromRows = (rows: Row[]): BusinessHours[] =>
  cleanHours(rows.map((r) => ({ weekday: Number(r.weekday), closed: r.closed === true, open: r.open, close: r.close, breakStart: r.break_start, breakEnd: r.break_end })));

export const hoursToRows = (merchantId: string, hours: BusinessHours[]) =>
  hours.map((h) => ({ merchant_id: merchantId, weekday: h.weekday, closed: h.closed, open: h.open, close: h.close, break_start: h.breakStart ?? null, break_end: h.breakEnd ?? null }));

const MERCHANT_COLS = "id, kakao_place_id, name, address, phone, lat, lng, place_url, status";

async function contextFor(merchantRow: Row | null): Promise<BookingContext | null> {
  const c = db();
  if (!c || !merchantRow) return null;
  const merchant = merchantFromRow(merchantRow);
  const [s, h, cl] = await Promise.all([
    c.from("reservation_settings").select("*").eq("merchant_id", merchant.id).maybeSingle(),
    c.from("merchant_hours").select("*").eq("merchant_id", merchant.id),
    c.from("merchant_closures").select("day").eq("merchant_id", merchant.id).gte("day", new Date(Date.now() - 86400_000).toISOString().slice(0, 10)),
  ]);
  return { merchant, settings: settingsFromRow(s.data), hours: hoursFromRows(h.data ?? []), closures: (cl.data ?? []).map((r) => str(r.day)) };
}

export async function bookingContext(merchantId: string): Promise<BookingContext | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.from("merchants").select(MERCHANT_COLS).eq("id", merchantId).maybeSingle();
  return contextFor(data);
}

export async function bookingContextByKakao(kakaoPlaceId: string): Promise<BookingContext | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.from("merchants").select(MERCHANT_COLS).eq("kakao_place_id", kakaoPlaceId).maybeSingle();
  return contextFor(data);
}

/** 손님이 예약할 수 있는 매장인가 — 승인 + 예약 받기 켬 */
export const isBookable = (ctx: BookingContext | null): boolean => !!ctx && ctx.merchant.status === "approved" && ctx.settings.accepting;

/** 식당 목록의 카카오 id 가운데 지금 예약을 받는 곳 */
export async function bookableKakaoIds(kakaoIds: string[]): Promise<Set<string>> {
  const c = db();
  const ids = [...new Set(kakaoIds.filter(Boolean))];
  if (!c || ids.length === 0) return new Set();
  const { data } = await c.from("merchants").select("kakao_place_id, reservation_settings(accepting)").in("kakao_place_id", ids).eq("status", "approved");
  return new Set((data ?? []).filter((r) => {
    const s = r.reservation_settings as unknown as { accepting?: boolean } | { accepting?: boolean }[] | null;
    return Array.isArray(s) ? s[0]?.accepting === true : s?.accepting === true;
  }).map((r) => str(r.kakao_place_id)));
}

export async function bookedSlots(merchantId: string, date: string): Promise<BookedSlot[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.rpc("reservation_booked", { p_merchant: merchantId, p_date: date });
  if (error) throw new Error(`reservation_booked: ${error.message}`);
  return ((data ?? []) as Row[]).map((r) => ({ time: str(r.visit_time), parties: Number(r.parties), people: Number(r.people) }));
}

export async function dayAvailability(ctx: BookingContext, date: string, now = new Date(), partySize?: number): Promise<DayAvailability> {
  const booked = await bookedSlots(ctx.merchant.id, date);
  return availableSlots({ hours: ctx.hours, closures: ctx.closures, settings: ctx.settings, date, now, booked, partySize });
}

export type CreateResult = { ok: true; id: string; code: string } | { ok: false; problem: string };

/** 예약 — 화면 규칙으로 먼저 거르고, DB 함수가 잠금을 걸어 정원을 최종 판정한다(즉시 확정) */
export async function createReservation(args: { ctx: BookingContext; userId: string; guestPhone: string; input: ReservationRequestInput; now?: Date }): Promise<CreateResult> {
  const c = db();
  if (!c) return { ok: false, problem: "지금은 예약할 수 없어요" };
  const { ctx, userId, guestPhone, input } = args;
  if (!isBookable(ctx)) return { ok: false, problem: reserveErrorMessage(ctx.merchant.status === "approved" ? "not_accepting" : "merchant_unavailable") };
  const day = await dayAvailability(ctx, input.date, args.now ?? new Date(), Number(input.partySize));
  const v = validateReservationRequest(input, ctx.settings, day);
  if (!v.ok) return { ok: false, problem: v.problem };
  const r = v.value;
  const { data, error } = await c.rpc("reserve", {
    p_merchant: ctx.merchant.id, p_user: userId, p_date: r.date, p_time: r.time, p_party: r.partySize,
    p_room: r.roomRequested, p_byo: r.bringOwnDrink, p_drink: r.drinkId, p_food: r.foodId, p_note: r.note,
    p_guest_name: r.guestName, p_guest_phone: guestPhone,
  });
  if (error) { console.error("[reserve]", error.message); return { ok: false, problem: reserveErrorMessage(null) }; }
  const res = data as { ok: boolean; error?: string; id?: string; code?: string };
  return res.ok ? { ok: true, id: str(res.id), code: str(res.code) } : { ok: false, problem: reserveErrorMessage(res.error) };
}

export type TransitionResult = { ok: true; from: ReservationStatus; to: ReservationStatus } | { ok: false; problem: string; code?: string };

export async function transitionReservation(id: string, to: ReservationStatus, actor: ReservationActor, actorId: string, note = ""): Promise<TransitionResult> {
  const c = db();
  if (!c) return { ok: false, problem: reserveErrorMessage(null) };
  const { data, error } = await c.rpc("reservation_transition", { p_id: id, p_to: to, p_actor: actor, p_actor_id: actorId, p_note: note });
  if (error) { console.error("[reservation_transition]", error.message); return { ok: false, problem: reserveErrorMessage(null) }; }
  const res = data as { ok: boolean; error?: string; from?: ReservationStatus; to?: ReservationStatus };
  return res.ok ? { ok: true, from: res.from!, to: res.to! } : { ok: false, problem: reserveErrorMessage(res.error), code: res.error };
}

/** 예약 한 건 — 손님·매장 화면 공용 모양(누가 볼지에 따라 번호를 가리는 것은 호출하는 쪽) */
export type Reservation = {
  id: string; code: string; userId: string | null; merchantId: string;
  date: string; time: string; visitAt: string; partySize: number;
  roomRequested: boolean; bringOwnDrink: boolean; drinkId: string | null; foodId: string | null; note: string;
  guestName: string; guestPhone: string; status: ReservationStatus; cancelReason: string; storeMemo: string;
  createdAt: string; merchant?: Pick<Merchant, "name" | "address" | "phone" | "kakaoPlaceId"> | null;
};

export const RESERVATION_COLS = "id, code, user_id, merchant_id, visit_date, visit_time, visit_at, party_size, room_requested, bring_own_drink, drink_id, food_id, note, guest_name, guest_phone, status, cancel_reason, store_memo, created_at";

export function reservationFromRow(r: Row): Reservation {
  const m = r.merchants as Row | null | undefined;
  return {
    id: str(r.id), code: str(r.code), userId: (r.user_id as string) ?? null, merchantId: str(r.merchant_id),
    date: str(r.visit_date), time: str(r.visit_time), visitAt: str(r.visit_at), partySize: Number(r.party_size),
    roomRequested: r.room_requested === true, bringOwnDrink: r.bring_own_drink === true,
    drinkId: (r.drink_id as string) ?? null, foodId: (r.food_id as string) ?? null, note: str(r.note),
    guestName: str(r.guest_name), guestPhone: str(r.guest_phone), status: str(r.status) as ReservationStatus,
    cancelReason: str(r.cancel_reason), storeMemo: str(r.store_memo), createdAt: str(r.created_at),
    merchant: m ? { name: str(m.name), address: str(m.address), phone: str(m.phone), kakaoPlaceId: str(m.kakao_place_id) } : null,
  };
}

/** 손님의 예약(최근 방문 순) */
export async function reservationsForUser(userId: string, limit = 50): Promise<Reservation[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("reservations").select(`${RESERVATION_COLS}, merchants(name, address, phone, kakao_place_id)`)
    .eq("user_id", userId).order("visit_at", { ascending: false }).limit(limit);
  return (data ?? []).map(reservationFromRow);
}

/** 매장의 예약(날짜 구간, 방문 시각 순) */
export async function reservationsForMerchant(merchantId: string, fromDate: string, toDate: string): Promise<Reservation[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("reservations").select(RESERVATION_COLS)
    .eq("merchant_id", merchantId).gte("visit_date", fromDate).lte("visit_date", toDate).order("visit_at", { ascending: true }).limit(500);
  return (data ?? []).map(reservationFromRow);
}

export async function reservationById(id: string): Promise<Reservation | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.from("reservations").select(`${RESERVATION_COLS}, merchants(name, address, phone, kakao_place_id)`).eq("id", id).maybeSingle();
  return data ? reservationFromRow(data) : null;
}

export type ReservationEvent = { from: ReservationStatus | null; to: ReservationStatus; actor: ReservationActor; note: string; at: string };
export async function reservationEvents(id: string): Promise<ReservationEvent[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("reservation_events").select("from_status, to_status, actor, note, created_at").eq("reservation_id", id).order("created_at");
  return (data ?? []).map((r) => ({ from: (r.from_status as ReservationStatus) ?? null, to: r.to_status as ReservationStatus, actor: r.actor as ReservationActor, note: str(r.note), at: str(r.created_at) }));
}
