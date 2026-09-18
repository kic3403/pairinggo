/**
 * 카카오 로컬 API(키워드 장소 검색) 클라이언트 — 서버 전용(KAKAO_REST_KEY).
 * 10분 메모리 캐시 + 최대 2페이지 병합(30건). 키가 없으면 빈 결과(source: none).
 */
import type { Place } from "@pairinggo/shared";

export type PlaceSearch = { query: string; lat?: number; lng?: number; radius?: number; category?: "FD6" | "CS2"; sort?: "distance" | "accuracy"; pages?: number };
export type PlaceResult = { places: Place[]; total: number; source: "kakao" | "none"; cached: boolean };

type KakaoDoc = { id: string; place_name: string; category_name: string; category_group_code: string; phone: string; address_name: string; road_address_name: string; x: string; y: string; place_url: string; distance: string };
type KakaoRes = { documents: KakaoDoc[]; meta: { total_count: number; pageable_count: number; is_end: boolean } };

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: PlaceResult }>();

export const kakaoConfigured = () => !!process.env.KAKAO_REST_KEY;

function toPlace(d: KakaoDoc): Place {
  const cats = (d.category_name || "").split(">").map((s) => s.trim()).filter(Boolean);
  return {
    id: d.id, name: d.place_name, category: cats[cats.length - 1] || "", categoryPath: d.category_name || "",
    address: d.address_name || "", roadAddress: d.road_address_name || "", phone: d.phone || null,
    lat: Number(d.y), lng: Number(d.x), distanceKm: d.distance ? Math.round(Number(d.distance) / 10) / 100 : null,
    placeUrl: d.place_url || null,
  };
}

export async function searchPlaces(p: PlaceSearch): Promise<PlaceResult> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return { places: [], total: 0, source: "none", cached: false };
  const hasLoc = p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng);
  const radius = hasLoc ? Math.min(20000, Math.max(500, Math.round(p.radius ?? 3000))) : undefined;
  const sort = hasLoc ? (p.sort ?? "distance") : "accuracy";
  const ck = JSON.stringify([p.query, p.category ?? "", hasLoc ? [p.lat!.toFixed(3), p.lng!.toFixed(3), radius] : null, sort, p.pages ?? 2]);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL) return { ...hit.value, cached: true };

  const pages = Math.min(3, Math.max(1, p.pages ?? 2));
  const out: Place[] = []; let total = 0;
  for (let page = 1; page <= pages; page++) {
    const qs = new URLSearchParams({ query: p.query, size: "15", page: String(page), sort });
    if (p.category) qs.set("category_group_code", p.category);
    if (hasLoc) { qs.set("x", String(p.lng)); qs.set("y", String(p.lat)); qs.set("radius", String(radius)); }
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${qs}`, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) { if (page === 1) throw new Error(`kakao ${res.status}`); break; }
    const j = (await res.json()) as KakaoRes;
    total = j.meta.pageable_count;
    out.push(...j.documents.map(toPlace));
    if (j.meta.is_end) break;
  }
  const seen = new Set<string>();
  const places = out.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  const value: PlaceResult = { places, total, source: "kakao", cached: false };
  cache.set(ck, { at: Date.now(), value });
  if (cache.size > 500) { const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100); for (const [k] of oldest) cache.delete(k); }
  return value;
}

/** 여러 검색어 결과를 합쳐 중복 제거(id), 거리순(거리 없으면 순서 유지) */
export async function searchMany(queries: string[], base: Omit<PlaceSearch, "query">): Promise<PlaceResult> {
  const results = await Promise.all(queries.map((q) => searchPlaces({ ...base, query: q, pages: 1 })));
  if (results.every((r) => r.source === "none")) return { places: [], total: 0, source: "none", cached: false };
  const seen = new Set<string>(); const places: Place[] = [];
  for (const r of results) for (const p of r.places) if (!seen.has(p.id)) { seen.add(p.id); places.push(p); }
  if (base.lat != null) places.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
  return { places, total: places.length, source: "kakao", cached: results.every((r) => r.cached) };
}

/* ---------- 간단 레이트리밋: IP당 분당 N회 (인스턴스 메모리). scope마다 따로 센다 — 한 버킷을 같이 쓰면 식당 검색을 몇 번 한 손님의 예약·인증이 막힌다 ---------- */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(req: Request, limit = 30, scope = "default"): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const k = `${scope}:${ip}`;
  const b = buckets.get(k);
  if (!b || b.reset < now) { buckets.set(k, { n: 1, reset: now + 60_000 }); return true; }
  if (b.n >= limit) return false;
  b.n++; return true;
}
