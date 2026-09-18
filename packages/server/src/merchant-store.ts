/**
 * 파트너 매장 정보·영업시간·휴무·예약 설정 저장(2026-09-18 사용자 결정: 바로 반영 + 변경 이력).
 * 매장 정보는 운영자 입력과 같은 place_info 표(source 'partner')에 써서 페어링GO 식당 카드에 바로 보인다.
 * 운영자 전용 값(contact_phone·memo)은 파트너가 저장해도 그대로 둔다.
 * 모든 저장은 merchant_changes에 전후 값을 남기고, 운영자는 /admin/partners에서 되돌린다.
 */
import {
  cleanDrinkItems, cleanHours, cleanMenuItems, cleanPlaceInfo, cleanSettings, isDate, isEmptyPlaceInfo, itemsToLists, kstParts,
  type BusinessHours, type PlaceInfo, type ReservationSettings,
} from "@pairinggo/shared";
import { db } from "./db";
import { hoursFromRows, hoursToRows, settingsFromRow, settingsToRow, type Merchant } from "./reservations";

export type ChangeSection = "info" | "hours" | "closures" | "settings";
type Row = Record<string, unknown>;

const need = () => { const c = db(); if (!c) throw new Error("DB가 연결되지 않았어요"); return c; };

/* ---------- 카탈로그 이름(술·메뉴 연결용) — 10분 메모리 캐시 ---------- */
type Named = { id: string; name: string };
let catalogCache: { at: number; drinks: Named[]; foods: Named[] } | null = null;
export async function catalogNames(): Promise<{ drinks: Named[]; foods: Named[] }> {
  if (catalogCache && Date.now() - catalogCache.at < 600_000) return catalogCache;
  const c = need();
  const [d, f] = await Promise.all([c.from("drinks").select("id, name").order("name").limit(2000), c.from("foods").select("id, name").order("name").limit(2000)]);
  catalogCache = { at: Date.now(), drinks: (d.data ?? []) as Named[], foods: (f.data ?? []) as Named[] };
  return catalogCache;
}

/* ---------- 변경 이력 ---------- */
async function logChange(merchantId: string, partnerUserId: string | null, section: ChangeSection, before: unknown, after: unknown) {
  await need().from("merchant_changes").insert({ merchant_id: merchantId, partner_user_id: partnerUserId, section, before, after });
}

/* ---------- 매장 정보 ---------- */
const placeRowToInfo = (r: Row): PlaceInfo => ({
  parking: (r.parking as PlaceInfo["parking"]) ?? null, parkingNote: String(r.parking_note ?? ""), corkage: (r.corkage as PlaceInfo["corkage"]) ?? null, corkageNote: String(r.corkage_note ?? ""),
  room: (r.room as PlaceInfo["room"]) ?? null, roomNote: String(r.room_note ?? ""), drinks: (r.drink_ids as string[]) ?? [], drinkNames: (r.drink_names as string[]) ?? [],
  foods: (r.food_ids as string[]) ?? [], menuNames: (r.menu_names as string[]) ?? [], menuNote: String(r.menu_note ?? ""), naverUrl: (r.naver_url as string) ?? null,
  menuItems: cleanMenuItems(r.menu_items), drinkItems: cleanDrinkItems(r.drink_items),
  source: r.source === "partner" ? "partner" : "operator", verifiedAt: (r.verified_at as string) ?? null,
});

export async function getStoreInfo(m: Merchant): Promise<{ phone: string; info: PlaceInfo | null }> {
  const { data } = await need().from("place_info").select("*").eq("kakao_id", m.kakaoPlaceId).maybeSingle();
  return { phone: m.phone, info: data ? placeRowToInfo(data) : null };
}

/** 사장님 저장 — 대표 번호(merchants.phone)와 매장 정보(place_info, source partner). 비어 있으면 place_info 행을 지운다 */
export async function saveStoreInfo(m: Merchant, partner: { id: string; name: string }, raw: { phone?: unknown; info?: Record<string, unknown> }): Promise<PlaceInfo | null> {
  const c = need();
  const cat = await catalogNames();
  const info = cleanPlaceInfo({ ...(raw.info ?? {}), source: "partner", verifiedAt: kstParts(new Date()).date }, { drinks: new Set(cat.drinks.map((d) => d.id)), foods: new Set(cat.foods.map((f) => f.id)) });
  // 메뉴판 표가 있으면 식당 카드의 술·메뉴 목록(카탈로그 연결)은 표에서 뽑는다 — 표가 원본
  if (info.menuItems.length || info.drinkItems.length) {
    const l = itemsToLists(info.menuItems, info.drinkItems, cat);
    info.drinks = l.drinkIds; info.drinkNames = l.drinkNames; info.foods = l.foodIds; info.menuNames = l.menuNames;
  }
  const phone = String(raw.phone ?? "").replace(/[^0-9\-]/g, "").slice(0, 20);
  const { data: before } = await c.from("place_info").select("*").eq("kakao_id", m.kakaoPlaceId).maybeSingle();
  const beforeAll = { phone: m.phone, place: before ?? null };

  if (phone !== m.phone) {
    const { error } = await c.from("merchants").update({ phone, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (error) throw new Error(error.message);
  }
  let after: Row | null = null;
  if (isEmptyPlaceInfo(info)) {
    if (before) await c.from("place_info").delete().eq("kakao_id", m.kakaoPlaceId);
  } else {
    const row = {
      kakao_id: m.kakaoPlaceId, name: m.name, address: m.address || null, phone: phone || null, lat: m.lat, lng: m.lng, place_url: m.placeUrl,
      parking: info.parking, parking_note: info.parkingNote, corkage: info.corkage, corkage_note: info.corkageNote, room: info.room, room_note: info.roomNote,
      drink_ids: info.drinks, food_ids: info.foods, drink_names: info.drinkNames, menu_names: info.menuNames, menu_note: info.menuNote, naver_url: info.naverUrl,
      menu_items: info.menuItems, drink_items: info.drinkItems,
      source: "partner", verified_at: info.verifiedAt, updated_by: `파트너 ${partner.name}`.slice(0, 40), updated_at: new Date().toISOString(),
      // contact_phone·memo는 운영자 전용 — 넣지 않아 기존 값이 그대로 남는다
    };
    const { data, error } = await c.from("place_info").upsert(row, { onConflict: "kakao_id" }).select("*").single();
    if (error) throw new Error(error.message);
    after = data;
  }
  await logChange(m.id, partner.id, "info", beforeAll, { phone, place: after });
  return after ? placeRowToInfo(after) : null;
}

/* ---------- 예약 설정 ---------- */
export async function saveSettings(m: Merchant, partnerUserId: string, raw: Record<string, unknown>): Promise<ReservationSettings> {
  const c = need();
  const s = cleanSettings(raw as Partial<Record<keyof ReservationSettings, unknown>>);
  const [{ data: before }, { data: hours }] = await Promise.all([
    c.from("reservation_settings").select("*").eq("merchant_id", m.id).maybeSingle(),
    c.from("merchant_hours").select("closed").eq("merchant_id", m.id),
  ]);
  if (s.accepting && !(hours ?? []).some((h) => h.closed === false)) throw new Error("영업시간을 먼저 정해 주세요 — 여는 요일이 하나도 없어요");
  const row = settingsToRow(m.id, s);
  const { error } = await c.from("reservation_settings").upsert(row, { onConflict: "merchant_id" });
  if (error) throw new Error(error.message);
  await logChange(m.id, partnerUserId, "settings", before ?? null, row);
  return s;
}

export async function getSettings(merchantId: string): Promise<ReservationSettings> {
  const { data } = await need().from("reservation_settings").select("*").eq("merchant_id", merchantId).maybeSingle();
  return settingsFromRow(data);
}

/* ---------- 영업시간 ---------- */
export async function getHours(merchantId: string): Promise<{ hours: BusinessHours[]; saved: boolean }> {
  const { data } = await need().from("merchant_hours").select("*").eq("merchant_id", merchantId);
  return { hours: hoursFromRows(data ?? []), saved: (data ?? []).length > 0 };
}

export async function saveHours(m: Merchant, partnerUserId: string, raw: unknown[]): Promise<BusinessHours[]> {
  const c = need();
  const hours = cleanHours(Array.isArray(raw) ? raw : []);
  const { data: before } = await c.from("merchant_hours").select("*").eq("merchant_id", m.id);
  const rows = hoursToRows(m.id, hours);
  const { error } = await c.from("merchant_hours").upsert(rows, { onConflict: "merchant_id,weekday" });
  if (error) throw new Error(error.message);
  // 여는 요일이 하나도 없으면 예약 받기도 끈다
  if (!hours.some((h) => !h.closed)) await c.from("reservation_settings").update({ accepting: false, updated_at: new Date().toISOString() }).eq("merchant_id", m.id);
  await logChange(m.id, partnerUserId, "hours", before ?? [], rows);
  return hours;
}

/* ---------- 임시 휴무 ---------- */
export async function getClosures(merchantId: string): Promise<{ day: string; note: string }[]> {
  const today = kstParts(new Date()).date;
  const { data } = await need().from("merchant_closures").select("day, note").eq("merchant_id", merchantId).gte("day", today).order("day");
  return (data ?? []).map((r) => ({ day: String(r.day), note: String(r.note ?? "") }));
}

/** 휴무 날짜 더하기·빼기 — 이미 예약이 잡힌 날을 휴무로 막으면 그 예약 수를 돌려준다(예약은 그대로, 사장님이 따로 연락·취소) */
export async function changeClosure(m: Merchant, partnerUserId: string, op: "add" | "remove", day: string, note = ""): Promise<{ bookedThatDay: number }> {
  const c = need();
  if (!isDate(day)) throw new Error("날짜를 골라 주세요");
  if (op === "add" && day < kstParts(new Date()).date) throw new Error("지난 날짜는 휴무로 정할 수 없어요");
  const before = await getClosures(m.id);
  if (op === "add") {
    const { error } = await c.from("merchant_closures").upsert({ merchant_id: m.id, day, note: String(note).replace(/\s+/g, " ").trim().slice(0, 40) }, { onConflict: "merchant_id,day" });
    if (error) throw new Error(error.message);
  } else {
    await c.from("merchant_closures").delete().eq("merchant_id", m.id).eq("day", day);
  }
  await logChange(m.id, partnerUserId, "closures", before, await getClosures(m.id));
  if (op === "remove") return { bookedThatDay: 0 };
  const { count } = await c.from("reservations").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).eq("visit_date", day).eq("status", "confirmed");
  return { bookedThatDay: count ?? 0 };
}

/* ---------- 어드민: 변경 이력·되돌리기 ---------- */
export type MerchantChange = { id: number; merchantId: string; merchantName: string; partnerName: string | null; section: ChangeSection; before: unknown; after: unknown; createdAt: string; revertedAt: string | null };

export async function recentChanges(limit = 50): Promise<MerchantChange[]> {
  const { data, error } = await need().from("merchant_changes")
    .select("id, merchant_id, section, before, after, created_at, reverted_at, merchants(name), partner_users(name)")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: Number(r.id), merchantId: String(r.merchant_id), section: r.section as ChangeSection, before: r.before, after: r.after,
    createdAt: String(r.created_at), revertedAt: (r.reverted_at as string) ?? null,
    merchantName: String((r.merchants as unknown as { name?: string } | null)?.name ?? ""),
    partnerName: (r.partner_users as unknown as { name?: string } | null)?.name ?? null,
  }));
}

/** 한 변경을 그 직전 값으로 되돌린다(되돌림도 이력으로 남는다 — partner_user_id 없음 = 운영자) */
export async function revertChange(id: number): Promise<void> {
  const c = need();
  const { data: ch } = await c.from("merchant_changes").select("*").eq("id", id).maybeSingle();
  if (!ch) throw new Error("변경 기록을 찾을 수 없어요");
  if (ch.reverted_at) throw new Error("이미 되돌린 변경이에요");
  const mid = String(ch.merchant_id);
  const before = ch.before as unknown;
  const now = new Date().toISOString();
  if (ch.section === "info") {
    const b = (before ?? {}) as { phone?: string; place?: Row | null };
    const { data: m } = await c.from("merchants").select("kakao_place_id").eq("id", mid).single();
    const { data: cur } = await c.from("place_info").select("*").eq("kakao_id", m!.kakao_place_id).maybeSingle();
    await c.from("merchants").update({ phone: b.phone ?? "", updated_at: now }).eq("id", mid);
    if (b.place) {
      const { created_at: _c, ...place } = b.place;
      // 운영자 전용 값은 지금 값을 유지한다
      await c.from("place_info").upsert({ ...place, contact_phone: cur?.contact_phone ?? place.contact_phone ?? "", memo: cur?.memo ?? place.memo ?? "" }, { onConflict: "kakao_id" });
    } else if (cur) await c.from("place_info").delete().eq("kakao_id", m!.kakao_place_id);
    await logChange(mid, null, "info", { phone: undefined, place: cur ?? null }, before);
  } else if (ch.section === "settings") {
    const { data: cur } = await c.from("reservation_settings").select("*").eq("merchant_id", mid).maybeSingle();
    if (before) await c.from("reservation_settings").upsert({ ...(before as Row), updated_at: now }, { onConflict: "merchant_id" });
    await logChange(mid, null, "settings", cur ?? null, before);
  } else if (ch.section === "hours") {
    const { data: cur } = await c.from("merchant_hours").select("*").eq("merchant_id", mid);
    await c.from("merchant_hours").delete().eq("merchant_id", mid);
    const rows = Array.isArray(before) ? (before as Row[]) : [];
    if (rows.length) await c.from("merchant_hours").insert(rows);
    await logChange(mid, null, "hours", cur ?? [], rows);
  } else if (ch.section === "closures") {
    const cur = await getClosures(mid);
    const today = kstParts(new Date()).date;
    await c.from("merchant_closures").delete().eq("merchant_id", mid).gte("day", today);
    const rows = (Array.isArray(before) ? (before as { day: string; note: string }[]) : []).filter((x) => x.day >= today).map((x) => ({ merchant_id: mid, day: x.day, note: x.note }));
    if (rows.length) await c.from("merchant_closures").insert(rows);
    await logChange(mid, null, "closures", cur, rows);
  }
  await c.from("merchant_changes").update({ reverted_at: now, reverted_by: "admin" }).eq("id", id);
}
