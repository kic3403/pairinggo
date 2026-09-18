/**
 * 운영자가 확인한 식당 정보(place_info, 0021) — 어드민 저장·목록, 공개 식당 검색 결과에 붙이기. service_role(db()) 사용.
 * 검증·표시 규칙은 shared place-info.ts. DB가 없으면 조용히 건너뛴다(정보 없이 목록만).
 */
import { cleanContactPhone, cleanDrinkItems, cleanMenuItems, cleanPlaceInfo, isEmptyPlaceInfo, type Place, type PlaceInfo } from "@pairinggo/shared";
import { db } from "./db";
import { getCatalog } from "./catalog";

type Row = {
  kakao_id: string; name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null; place_url: string | null;
  parking: PlaceInfo["parking"]; parking_note: string; corkage: PlaceInfo["corkage"]; corkage_note: string; room: PlaceInfo["room"]; room_note: string;
  drink_ids: string[]; food_ids: string[]; drink_names: string[]; menu_names: string[]; contact_phone: string; naver_url: string | null; menu_note: string; menu_items: unknown; drink_items: unknown; memo: string; source: PlaceInfo["source"]; verified_at: string | null; updated_by: string | null; updated_at: string;
};
/** contactPhone·memo는 운영자 전용 — 어드민 화면에만 내려간다(공개 API는 info만 쓴다) */
export type PlaceInfoRow = { kakaoId: string; name: string; address: string; phone: string | null; placeUrl: string | null; contactPhone: string; memo: string; updatedBy: string | null; updatedAt: string; info: PlaceInfo };

const toInfo = (r: Row): PlaceInfo => ({
  parking: r.parking, parkingNote: r.parking_note, corkage: r.corkage, corkageNote: r.corkage_note, room: r.room, roomNote: r.room_note,
  drinks: r.drink_ids ?? [], drinkNames: r.drink_names ?? [], foods: r.food_ids ?? [], menuNames: r.menu_names ?? [], menuNote: r.menu_note, naverUrl: r.naver_url ?? null,
  menuItems: cleanMenuItems(r.menu_items), drinkItems: cleanDrinkItems(r.drink_items), source: r.source, verifiedAt: r.verified_at,
});
const toRow = (r: Row): PlaceInfoRow => ({ kakaoId: r.kakao_id, name: r.name, address: r.address ?? "", phone: r.phone, placeUrl: r.place_url, contactPhone: r.contact_phone ?? "", memo: r.memo, updatedBy: r.updated_by, updatedAt: r.updated_at, info: toInfo(r) });

/** 식당 검색 결과에 운영자 확인 정보를 붙인다(한 번의 조회). 실패는 조용히 */
export async function attachPlaceInfo(places: Place[]): Promise<Place[]> {
  const sb = db();
  if (!sb || !places.length) return places;
  const { data, error } = await sb.from("place_info").select("*").in("kakao_id", places.map((p) => p.id));
  if (error) { console.warn("[place-info]", error.message); return places; }
  const by = new Map(((data ?? []) as Row[]).map((r) => [r.kakao_id, toInfo(r)]));
  return by.size ? places.map((p) => (by.has(p.id) ? { ...p, info: by.get(p.id)! } : p)) : places;
}

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정 — 어드민은 DB가 필요합니다"); return sb; };

export async function listPlaceInfo(): Promise<PlaceInfoRow[]> {
  const { data, error } = await need().from("place_info").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toRow);
}

export async function getPlaceInfo(kakaoId: string): Promise<PlaceInfoRow | null> {
  const { data, error } = await need().from("place_info").select("*").eq("kakao_id", kakaoId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data as Row) : null;
}

export type PlaceInfoInput = { place: { id: string; name: string; address?: string; phone?: string | null; lat?: number; lng?: number; placeUrl?: string | null }; info: Record<string, unknown>; contactPhone?: string; memo?: string; updatedBy?: string };

export async function savePlaceInfo(input: PlaceInfoInput): Promise<PlaceInfoRow> {
  const id = String(input.place?.id ?? "").trim(), name = String(input.place?.name ?? "").trim().slice(0, 80);
  if (!/^\d{3,20}$/.test(id) || !name) throw new Error("식당을 먼저 검색해서 골라 주세요");
  const c = await getCatalog();
  const info = cleanPlaceInfo(input.info ?? {}, { drinks: new Set(c.dataset.drinks.map((d) => d.id)), foods: new Set(c.dataset.foods.map((f) => f.id)) });
  if (isEmptyPlaceInfo(info)) throw new Error("적은 내용이 없어요 — 주차·콜키지·룸·술·메뉴 중 하나는 적어 주세요");
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const row = {
    kakao_id: id, name, address: String(input.place.address ?? "").slice(0, 160) || null, phone: input.place.phone ? String(input.place.phone).slice(0, 30) : null,
    lat: num(input.place.lat), lng: num(input.place.lng), place_url: input.place.placeUrl ? String(input.place.placeUrl).slice(0, 200) : null,
    parking: info.parking, parking_note: info.parkingNote, corkage: info.corkage, corkage_note: info.corkageNote, room: info.room, room_note: info.roomNote,
    drink_ids: info.drinks, food_ids: info.foods, drink_names: info.drinkNames, menu_names: info.menuNames, contact_phone: cleanContactPhone(input.contactPhone), naver_url: info.naverUrl, menu_note: info.menuNote, memo: String(input.memo ?? "").slice(0, 300), source: info.source,
    verified_at: info.verifiedAt ?? new Date().toISOString().slice(0, 10), updated_by: String(input.updatedBy ?? "운영자").slice(0, 40), updated_at: new Date().toISOString(),
  };
  const { data, error } = await need().from("place_info").upsert(row, { onConflict: "kakao_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return toRow(data as Row);
}

export async function deletePlaceInfo(kakaoId: string): Promise<void> {
  const { error } = await need().from("place_info").delete().eq("kakao_id", kakaoId);
  if (error) throw new Error(error.message);
}
