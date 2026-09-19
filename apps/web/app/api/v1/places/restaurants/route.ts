import { placeQuery, RBY, D as _D } from "@pairinggo/shared";
import { reportError } from "@pairinggo/server/errors";
import { getCatalog } from "@/lib/catalog";
import { kakaoConfigured, rateLimit, searchPlaces } from "@/lib/kakao";
import { attachRatings, googlePlacesConfigured } from "@/lib/google-places";
import { withAwards, withBookable, withInfo, withReviews } from "@/lib/place-enrich";
import { matchFirst, placeMatch, rankPlaces, similarFoods, sortByRating, verifiedFirst, type Place, type PlaceMatchTarget } from "@pairinggo/shared";
import { nearbyPlaceInfo } from "@/lib/place-info";
import { error, json, preflight } from "@/lib/http";

export const runtime = "nodejs";
const CACHE = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };
void _D;

/**
 * GET /api/v1/places/restaurants?food=육회&lat=&lng=&radius=3000&region=hongdae&sort=distance
 * 카카오 로컬(음식점 FD6). 좌표가 있으면 반경·거리순, 없으면 관심지역 좌표(REGIONS) 또는 지역어+정확도순.
 * 운영자가 확인한 식당(place_info)은 콜키지·룸·주차·취급 전통주·대표 메뉴를 붙여 맨 앞에 둔다(2026-09-17).
 * 앞 12곳에는 구글 지도 평점(lib/google-places.ts, 30일 캐시)을 붙이고 평점 높은 순으로 정렬한다(2026-09-14 사용자 결정) — 응답 ratingSource: "google" | null.
 * &drink=d11(2026-09-19): 술을 골라 들어왔으면 그 술과 같은(비슷한) 음식을 함께 파는 식당을 맨 앞에(shared place-match — 확인 정보 기준).
 *   카카오 키워드 검색에 안 걸린 주변의 확인된 식당도 그 음식(또는 그 술)을 팔면 5곳까지 더한다. 술이 없으면 같은·비슷한 메뉴가 있는 곳만 앞으로.
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 30, "restaurants")) return error(req, 429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요");
  const sp = new URL(req.url).searchParams;
  const food = (sp.get("food") || "").trim().slice(0, 40);
  if (!food) return error(req, 400, "food 파라미터가 필요합니다");
  const c = await getCatalog();
  const f = c.dataset.foods.find((x) => x.name === food || x.id === food);
  const drinkQ = (sp.get("drink") || "").trim().slice(0, 40);
  const dk = drinkQ ? c.dataset.drinks.find((x) => x.id === drinkQ || x.name === drinkQ) : undefined;
  const target: PlaceMatchTarget = {
    drink: dk ? { id: dk.id, name: dk.name, category: dk.category } : null,
    food: f ? { id: f.id, name: f.name, alias: f.alias } : { id: "", name: food },
    similarFoods: f ? similarFoods(f, 8).map((s) => ({ id: s.x.id, name: s.x.name, alias: s.x.alias })) : [],
    drinkCatalog: new Map(c.dataset.drinks.map((d) => [d.id, { name: d.name, category: d.category }])),
  };
  const keyword = f ? placeQuery(f) : food;
  let lat = parseFloat(sp.get("lat") || ""), lng = parseFloat(sp.get("lng") || "");
  let radius = parseInt(sp.get("radius") || "3000");
  const region = sp.get("region") ? RBY[sp.get("region")!] : undefined;
  let regionWord = "";
  if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
    if (region && region.id !== "all") { lat = region.lat; lng = region.lng; radius = Math.min(20000, region.radius); regionWord = region.q; }
    else { lat = NaN; lng = NaN; }
  }
  const sort = sp.get("sort") === "accuracy" ? "accuracy" : "distance";
  const query = regionWord && !(Number.isFinite(lat) && Number.isFinite(lng)) ? `${regionWord} ${keyword}` : keyword;
  try {
    const r = await searchPlaces({ query: query.includes("맛집") ? query : `${query} 맛집`, lat: Number.isFinite(lat) ? lat : undefined, lng: Number.isFinite(lng) ? lng : undefined, radius, category: "FD6", sort });
    // 반경 검색에서 너무 적으면 반경을 넓혀 한 번 더 (최대 20km)
    let places = r.places;
    if (r.source === "kakao" && places.length < 5 && Number.isFinite(lat) && radius < 20000) {
      const wide = await searchPlaces({ query: `${keyword} 맛집`, lat, lng, radius: Math.min(20000, radius * 3), category: "FD6", sort });
      if (wide.places.length > places.length) { places = wide.places; radius = Math.min(20000, radius * 3); }
    }
    // 미쉐린 배지 — 이름+좌표 대조(packages/shared/awards.ts)
    const aw = await withAwards(places);
    // 평점 높은 순 → 그 위에 관련도(이름·분류에 음식 이름/키워드 → 같은 계열 → 다른 계열, shared placeRelevance)로 다시 묶는다
    places = rankPlaces(sortByRating(await attachRatings(aw.places)), f ?? { name: food });
    // 카카오 검색에 없던 주변의 확인된 식당 중 고른 조합(술 또는 같은 음식)을 파는 곳 — 가까운 순 5곳까지
    if (Number.isFinite(lat)) {
      const seen = new Set(places.map((p) => p.id));
      const near = (await nearbyPlaceInfo(lat, lng, radius).catch(() => [] as Place[]))
        // 그 술을 팔거나, 같은 음식을 팔거나, 비슷한 음식 + 같은 종류 술 — 같은 종류 술만·비슷한 음식만 있는 곳은 넣지 않는다
        .filter((p) => { const m = placeMatch(p.info, target); return !seen.has(p.id) && (m.drink === "exact" || m.food === "exact" || (m.drink === "kind" && m.food === "similar")); }).slice(0, 5);
      places = [...places, ...near];
    }
    // 운영자·파트너가 확인한 정보(place_info) — 확인된 식당을 맨 앞으로, 그 위에 예약 받는 파트너 매장. 목록 API는 10분 캐시라 반영에 최대 10분
    const ranked = await withBookable(verifiedFirst(await withInfo(places)), true);
    // 맨 위: 고른 조합을 파는 곳(점수 높은 순) — 같은 점수 안에서는 위 순서 그대로
    places = await withReviews(matchFirst(ranked.map((p) => { const m = placeMatch(p.info, target); return m.score ? { ...p, match: m } : p; })));
    return json(req, { food: f?.name ?? food, drink: dk ? { id: dk.id, name: dk.name } : null, query, center: Number.isFinite(lat) ? { lat, lng, radius } : null, places, total: r.total, source: kakaoConfigured() ? r.source : "none", awardsYear: aw.year, ratingSource: googlePlacesConfigured() ? "google" : null }, { headers: CACHE });
  } catch (e) {
    void reportError("web", "places/restaurants", e);
    return json(req, { food, query, center: null, places: [], total: 0, source: "none", error: "검색 실패" }, { headers: { "Cache-Control": "no-store" } });
  }
}
export function OPTIONS(req: Request) { return preflight(req); }
