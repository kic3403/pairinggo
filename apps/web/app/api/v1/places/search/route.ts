import { RBY } from "@pairinggo/shared";
import { attachRatings, googlePlacesConfigured } from "@/lib/google-places";
import { error, json, preflight } from "@/lib/http";
import { kakaoConfigured, rateLimit, searchPlaces } from "@/lib/kakao";
import { withAwards, withBookable, withInfo } from "@/lib/place-enrich";

export const runtime = "nodejs";
const CACHE = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };

export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * GET /api/v1/places/search?q=성심당&lat=&lng=&region=hongdae — 식당 이름·키워드 검색(2026-09-19 사용자 요청).
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
    const aw = await withAwards(r.places);
    const places = await withBookable(await withInfo(await attachRatings(aw.places)), false);
    return json(req, {
      query: q, center: hasLoc ? { lat, lng, radius: 20000 } : null, places, total: r.total,
      source: kakaoConfigured() ? r.source : "none", awardsYear: aw.year, ratingSource: googlePlacesConfigured() ? "google" : null,
    }, { headers: CACHE });
  } catch (e) {
    console.error("[places/search]", (e as Error).message);
    return json(req, { query: q, center: null, places: [], total: 0, source: "none", error: "검색 실패" }, { headers: { "Cache-Control": "no-store" } });
  }
}
