import { RBY, sortByNameMatch } from "@pairinggo/shared";
import { reportError } from "@pairinggo/server/errors";
import { attachRatings, googlePlacesConfigured } from "@/lib/google-places";
import { error, json, preflight } from "@/lib/http";
import { kakaoConfigured, rateLimit, searchPlaces } from "@/lib/kakao";
import { withAwards, withBookable, withInfo, withReviews } from "@/lib/place-enrich";
import { partnerPlacesByName } from "@/lib/place-info";

export const runtime = "nodejs";
const CACHE = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };

export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * GET /api/v1/places/search?q=성심당&lat=&lng=&region=hongdae&lite=1 — 식당 이름·키워드 검색(2026-09-19 사용자 요청).
 * lite=1: 술·음식 검색 결과 화면의 식당 칸 — 구글 평점을 붙이지 않는다(하루 150회 상한 보호).
 * 카카오 로컬(음식점 FD6)을 사용자가 검색할 때만 부른다. 좌표·관심지역이 있으면 그 주변 20km 안에서, 없으면 전국.
 * 순서는 카카오 정확도 그대로(이름 검색이라 맞는 이름이 먼저) — 평점·확인 정보·메뉴판·예약 가능 표시는 맛집 목록과 같게 붙인다.
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 30, "place-search")) return error(req, 429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요");
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (q.length < 2) return error(req, 400, "두 글자 이상 적어 주세요");
  let lat = parseFloat(sp.get("lat") || ""), lng = parseFloat(sp.get("lng") || "");
  const region = sp.get("region") ? RBY[sp.get("region")!] : undefined;
  if (!(Number.isFinite(lat) && Number.isFinite(lng)) && region && region.id !== "all") { lat = region.lat; lng = region.lng; }
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
  try {
    const r = await searchPlaces({ query: q, lat: hasLoc ? lat : undefined, lng: hasLoc ? lng : undefined, radius: 20000, category: "FD6", sort: "accuracy", pages: 2 });
    // 이름으로 찾는 사람이 많다 — 주변 결과에 그 이름이 없으면 전국에서도 찾아, 이름이 맞는 곳을 맨 앞에 붙인다(2026-09-19: 대전 관심지역에서 서울 "유록"이 안 나옴)
    const key = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    let found = r.places, widened = false;
    if (hasLoc && !found.some((p) => key(p.name).includes(key(q)))) {
      const all = await searchPlaces({ query: q, category: "FD6", sort: "accuracy", pages: 1 });
      const named = all.places.filter((p) => key(p.name).includes(key(q)) && !found.some((x) => x.id === p.id));
      if (named.length) { found = [...named, ...found]; widened = true; }
    }
    // 우리 파트너 매장은 카카오 분류(FD6)에 안 걸려도 이름으로 찾을 수 있어야 한다 — 양조장·리쿼샵(2026-09-20)
    const partners = await partnerPlacesByName(q).catch(() => []);
    if (partners.length) found = [...partners.filter((p) => !found.some((x) => x.id === p.id)), ...found];
    const aw = await withAwards(found);
    const lite = sp.get("lite") === "1";
    // 카카오는 메뉴명·태그까지 보고 찾는다("유록" → 이름이 다른 "오징어세상") — 이름이 맞는 곳을 먼저
    const places = sortByNameMatch(await withReviews(await withBookable(await withInfo(lite ? aw.places : await attachRatings(aw.places)), false)), q);
    return json(req, {
      query: q, center: hasLoc ? { lat, lng, radius: 20000 } : null, places, total: r.total, widened,
      source: kakaoConfigured() ? r.source : "none", awardsYear: aw.year, ratingSource: googlePlacesConfigured() ? "google" : null,
    }, { headers: CACHE });
  } catch (e) {
    void reportError("web", "places/search", e);
    return json(req, { query: q, center: null, places: [], total: 0, source: "none", error: "검색 실패" }, { headers: { "Cache-Control": "no-store" } });
  }
}
