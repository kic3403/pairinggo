/**
 * 식당 목록에 붙이는 것들 — 음식별 맛집(/api/v1/places/restaurants)과 식당 검색(/api/v1/places/search)이 함께 쓴다(2026-09-19).
 *  · 미쉐린 배지(이름+좌표 대조) · 운영자·파트너 확인 정보(place_info)와 화면용 술·메뉴 이름 · 파트너 예약 가능 여부
 * 정렬은 각 라우트가 정한다(맛집 = 평점·관련도·확인 우선, 검색 = 카카오 정확도 그대로).
 */
import { matchAward, toSlug, type Place, type ReviewStats } from "@pairinggo/shared";
import { reviewStatsFor } from "./reviews";
import { bookableKakaoIds } from "@pairinggo/server/reservations";
import { loadAwards } from "./awards";
import { getCatalog } from "./catalog";
import { attachPlaceInfo } from "./place-info";

type Named = { id: string; name: string; slug: string | null };
export type EnrichedPlace = Place & { infoView?: { drinks: Named[]; foods: Named[] }; bookable?: boolean; reviews?: ReviewStats };

/** 미쉐린 배지 — 표가 비어 있으면 그대로 */
export async function withAwards<T extends Place>(places: T[]): Promise<{ places: T[]; year: number | null }> {
  const aw = await loadAwards();
  return { places: aw.list.length ? places.map((p) => ({ ...p, award: matchAward(p, aw.list) })) : places, year: aw.year };
}

/** 확인 정보 + 화면용 술·메뉴 이름(카탈로그에 있으면 그 페이지 링크) */
export async function withInfo<T extends Place>(places: T[]): Promise<(T & { infoView?: EnrichedPlace["infoView"] })[]> {
  const c = await getCatalog();
  const DN = new Map(c.dataset.drinks.map((d) => [d.id, d.name])), FN = new Map(c.dataset.foods.map((x) => [x.id, x.name]));
  const named = (ids: string[], by: Map<string, string>): Named[] => ids.filter((id) => by.has(id)).map((id) => ({ id, name: by.get(id)!, slug: toSlug(by.get(id)!) }));
  return (await attachPlaceInfo(places)).map((p) => (p.info ? {
    ...p,
    infoView: {
      drinks: [...named(p.info.drinks, DN), ...p.info.drinkNames.map((name) => ({ id: name, name, slug: null }))],
      foods: [...named(p.info.foods, FN), ...p.info.menuNames.map((name) => ({ id: name, name, slug: null }))],
    },
  } : p)) as (T & { infoView?: EnrichedPlace["infoView"] })[];
}

/** 파트너 앱에서 예약을 받는 매장 표시 — front면 목록 맨 앞으로(같은 순서 안에서 안정 정렬) */
export async function withBookable<T extends Place>(places: T[], front: boolean): Promise<(T & { bookable?: boolean })[]> {
  const ids = await bookableKakaoIds(places.map((p) => p.id)).catch(() => new Set<string>());
  if (!ids.size) return places;
  const marked = places.map((p) => (ids.has(p.id) ? { ...p, bookable: true } : p));
  return front ? [...marked.filter((p) => ids.has(p.id)), ...marked.filter((p) => !ids.has(p.id))] : marked;
}

/** 페어링GO 방문 인증 리뷰 평균·개수(있는 곳만) — 카드의 "★ 4.5 (3) 페어링GO" */
export async function withReviews<T extends Place>(places: T[]): Promise<(T & { reviews?: ReviewStats })[]> {
  const m = await reviewStatsFor(places.map((p) => p.id)).catch(() => new Map<string, ReviewStats>());
  return m.size ? places.map((p) => (m.has(p.id) ? { ...p, reviews: m.get(p.id) } : p)) : places;
}
