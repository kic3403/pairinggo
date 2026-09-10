import { RBY } from "@pairinggo/shared";
import { kakaoConfigured, rateLimit, searchMany } from "@/lib/kakao";
import { error, json, preflight } from "@/lib/http";

export const runtime = "nodejs";
const CACHE = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };

/**
 * GET /api/v1/places/bottleshops?lat=&lng=&radius=&region=&kind=trad|all
 * kind=trad: 전통주 판매점·보틀샵 / kind=all: 온라인 판매 불가 주류용 — 주류판매점·마트·편의점 포함
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 30)) return error(req, 429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요");
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") === "all" ? "all" : "trad";
  let lat = parseFloat(sp.get("lat") || ""), lng = parseFloat(sp.get("lng") || "");
  let radius = parseInt(sp.get("radius") || "5000");
  const region = sp.get("region") ? RBY[sp.get("region")!] : undefined;
  let regionWord = "";
  if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
    if (region && region.id !== "all") { lat = region.lat; lng = region.lng; radius = Math.min(20000, region.radius); regionWord = region.q; }
  }
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
  const words = kind === "trad" ? ["전통주 판매점", "전통주 보틀샵", "우리술 전문점"] : ["주류판매점", "보틀샵", "와인샵"];
  const queries = words.map((w) => (hasLoc ? w : `${regionWord} ${w}`.trim()));
  try {
    const r = await searchMany(queries, { lat: hasLoc ? lat : undefined, lng: hasLoc ? lng : undefined, radius, sort: "distance" });
    // 키워드 검색 잡음(컨설팅·사무실 등) 제거 — 술을 파는 곳으로 보이는 카테고리만
    const SELLS = /주류|술|소매|편의점|마트|판매|와인|양조|음식점|전통/;
    const NOISE = /컨설팅|사무실|협회|학원|교육|제조업|도매/;
    const places = r.places.filter((p) => SELLS.test(p.categoryPath) && !NOISE.test(p.categoryPath)).slice(0, 30);
    return json(req, { kind, center: hasLoc ? { lat, lng, radius } : null, places, total: places.length, source: kakaoConfigured() ? r.source : "none" }, { headers: CACHE });
  } catch (e) {
    console.error("[places/bottleshops]", (e as Error).message);
    return json(req, { kind, center: null, places: [], total: 0, source: "none", error: "검색 실패" }, { headers: { "Cache-Control": "no-store" } });
  }
}
export function OPTIONS(req: Request) { return preflight(req); }
