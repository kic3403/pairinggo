/**
 * 매장 상세(/places/[카카오id], 2026-09-19) — 모든 식당. 카카오 로컬은 id로 다시 찾는 API가 없어 이렇게 모은다:
 *  ① 파트너 매장(merchants, 승인) ② 운영자·파트너 정보(place_info) ③ 링크에 붙은 이름(?n=)으로 카카오 검색해 같은 id ④ 그 식당 리뷰에 남은 이름·주소
 * 파트너 매장이면 대표 사진·메뉴판·예약까지, 아니면 기본 정보 + Google 평점(캐시) + 리뷰.
 */
import { isManualPlaceId, isPlaceId, toSlug, type PartnerKind, type Place, type PlaceInfo } from "@pairinggo/shared";
import { getCatalog } from "./catalog";
import { bookingContextByKakao, isBookable } from "@pairinggo/server/reservations";
import { db } from "./db";
import { searchPlaces } from "./kakao";
import { getPlaceInfo } from "./place-info";
import { attachRatings } from "./google-places";
import { withAwards, withInfo } from "./place-enrich";

export type PlaceBase = { id: string; name: string; category: string; address: string; phone: string | null; lat: number | null; lng: number | null; placeUrl: string | null };
/** 영수증 대조용(서버 전용) — 파트너 매장이면 사업자번호까지 */
export type PlaceForReceipt = { name: string; phone: string | null; bizNo: string | null };

const validId = (id: string) => isPlaceId(id);

/** 식당 기본 정보 — 못 찾으면 null */
export async function placeBase(kakaoId: string, nameHint?: string | null): Promise<(PlaceBase & { bizNo: string | null; merchant: boolean }) | null> {
  if (!validId(kakaoId)) return null;   // 직접 입력 매장(manual-…)도 파트너면 merchants에서 찾는다(2026-09-27)
  const c = db();
  const [ctx, pi] = await Promise.all([bookingContextByKakao(kakaoId).catch(() => null), getPlaceInfo(kakaoId).catch(() => null)]);
  let bizNo: string | null = null;
  if (ctx && c) bizNo = ((await c.from("merchants").select("biz_no").eq("id", ctx.merchant.id).maybeSingle()).data?.biz_no as string | undefined) ?? null;
  const merchant = !!ctx && ctx.merchant.status === "approved";
  if (merchant) {
    const m = ctx!.merchant;
    return { id: kakaoId, name: m.name, category: "", address: m.address, phone: m.phone || null, lat: m.lat ?? null, lng: m.lng ?? null, placeUrl: m.placeUrl ?? null, bizNo, merchant };
  }
  // 이름이 있으면 카카오에서 같은 id를 찾아 최신 값으로(분류·전화) — 없거나 못 찾으면 저장된 값
  const hint = isManualPlaceId(kakaoId) ? "" : String(nameHint ?? "").trim().slice(0, 40) || pi?.name || "";   // manual id는 카카오에 없다
  if (hint) {
    const found = await searchPlaces({ query: hint, pages: 1 }).catch(() => null);
    const p = found?.places.find((x) => x.id === kakaoId);
    if (p) return { id: kakaoId, name: p.name, category: p.category, address: p.roadAddress || p.address, phone: p.phone, lat: p.lat, lng: p.lng, placeUrl: p.placeUrl, bizNo, merchant };
  }
  if (pi) return { id: kakaoId, name: pi.name, category: "", address: pi.address, phone: pi.phone, lat: null, lng: null, placeUrl: pi.placeUrl, bizNo, merchant };
  if (c) {
    const { data } = await c.from("place_reviews").select("place_name, place_address").eq("kakao_id", kakaoId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return { id: kakaoId, name: String(data.place_name), category: "", address: String(data.place_address ?? ""), phone: null, lat: null, lng: null, placeUrl: isManualPlaceId(kakaoId) ? null : `https://place.map.kakao.com/${kakaoId}`, bizNo, merchant };
  }
  return null;
}

export type PlaceDetail = {
  place: Place & { info?: PlaceInfo | null; infoView?: { drinks: { id: string; name: string; slug: string | null }[]; foods: { id: string; name: string; slug: string | null }[] } };
  bookable: boolean; partner: boolean; awardsYear: number | null;
  /** 파트너 업종 — 식당·양조장·리쿼샵 (2026-09-20) */
  kind: PartnerKind;
  /** 양조장 파트너가 고른 카탈로그 양조장과 그 술들(0031) */
  brewery: { name: string; drinks: { id: string; name: string; slug: string; category: string; abv: number | null }[] } | null;
};

/** 상세 화면 데이터 — 확인 정보·메뉴판·대표 사진·Google 평점(캐시, 없으면 한 번 조회)·미쉐린 배지·예약 가능 */
export async function placeDetail(kakaoId: string, nameHint?: string | null): Promise<PlaceDetail | null> {
  const b = await placeBase(kakaoId, nameHint);
  if (!b) return null;
  const base: Place = {
    id: b.id, name: b.name, category: b.category, categoryPath: b.category, address: b.address, roadAddress: b.address, phone: b.phone,
    lat: b.lat ?? 0, lng: b.lng ?? 0, distanceKm: null, placeUrl: b.placeUrl ?? `https://place.map.kakao.com/${kakaoId}`,
  };
  const withGoogle = b.lat != null ? (await attachRatings([base]).catch(() => [base]))[0] : base;
  const aw = b.lat != null ? await withAwards([withGoogle]).catch(() => ({ places: [withGoogle], year: null })) : { places: [withGoogle], year: null };
  const [p] = await withInfo(aw.places);
  const ctx = b.merchant ? await bookingContextByKakao(kakaoId).catch(() => null) : null;
  const kind = ctx?.merchant.kind ?? "restaurant";
  const brewery = ctx?.merchant.brewery ? await breweryDrinks(ctx.merchant.brewery) : null;
  return { place: p, bookable: !!ctx && isBookable(ctx), partner: b.merchant, awardsYear: aw.year, kind, brewery };
}

/** 그 양조장의 카탈로그 전통주 (양조장 파트너 화면·술 화면 연결, 0031) */
export async function breweryDrinks(name: string): Promise<{ name: string; drinks: { id: string; name: string; slug: string; category: string; abv: number | null }[] } | null> {
  const key = String(name ?? "").replace(/\s+/g, "").toLowerCase();
  if (!key) return null;
  const c = await getCatalog();
  const drinks = c.dataset.drinks
    .filter((x) => String(x.brewery ?? "").replace(/\s+/g, "").toLowerCase() === key)
    .map((x) => ({ id: x.id, name: x.name, slug: toSlug(x.name), category: x.category, abv: x.abv ?? null }));
  return { name, drinks };
}

/** 이 양조장을 운영하는 파트너 매장 — 술 화면의 "양조장 방문 시음 예약" (0031) */
export async function breweryPartner(breweryName: string): Promise<{ kakaoId: string; name: string; address: string; bookable: boolean } | null> {
  const c = db();
  const name = String(breweryName ?? "").trim();
  if (!c || !name) return null;
  const { data } = await c.from("merchants").select("kakao_place_id, name, address, status").eq("brewery", name).eq("status", "approved").limit(1).maybeSingle();
  if (!data) return null;
  const ctx = await bookingContextByKakao(String(data.kakao_place_id)).catch(() => null);
  return { kakaoId: String(data.kakao_place_id), name: String(data.name), address: String(data.address ?? ""), bookable: !!ctx && isBookable(ctx) };
}
