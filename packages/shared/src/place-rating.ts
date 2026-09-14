/**
 * 식당 평점 — 카카오 장소 목록에 구글 지도 평점(Places API (New))을 대조해 붙인다(2026-09-14 사용자 결정).
 * 카카오·네이버는 평점 API가 없고 긁어오면 약관 위반이라 구글만 쓴다. 대조 규칙만 여기(순수 함수), 호출·30일 캐시는 apps/web/lib/google-places.ts.
 */
import { normalizePlaceName } from "./awards";

export type PlaceRating = { score: number; count: number; source: "google"; googleId?: string };
export type GoogleCandidate = { id: string; name: string; lat: number; lng: number; rating: number | null; count: number };

/** 같은 가게로 보는 최대 거리 — 카카오·구글 좌표가 건물 안에서 조금씩 다르다. 체인점끼리는 이보다 멀다 */
export const MATCH_RADIUS_M = 150;
/** 리뷰가 이보다 적으면 평점을 보여 주지 않는다 — "★ 5.0 (1)"은 정보가 아니라 잡음 */
export const MIN_RATING_COUNT = 5;

const distM = (a: number, b: number, c: number, d: number) => {
  const t = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/** 구글 검색 결과 중 카카오 장소와 같은 가게 — 이름 일치(같거나 포함) + 150m 안 + 평점 있음. 가장 가까운 것 */
export function pickGoogleMatch(place: { name: string; lat: number; lng: number }, candidates: GoogleCandidate[]): GoogleCandidate | null {
  const pn = normalizePlaceName(place.name);
  if (!pn) return null;
  let best: { c: GoogleCandidate; d: number } | null = null;
  for (const c of candidates) {
    if (c.rating == null || c.count < MIN_RATING_COUNT) continue;
    const cn = normalizePlaceName(c.name);
    if (!cn) continue;
    const ok = pn === cn || (pn.length >= 3 && cn.length >= 3 && (pn.includes(cn) || cn.includes(pn)));
    if (!ok) continue;
    const d = distM(place.lat, place.lng, c.lat, c.lng);
    if (d > MATCH_RADIUS_M) continue;
    if (!best || d < best.d) best = { c, d };
  }
  return best?.c ?? null;
}

export const ratingText = (r: Pick<PlaceRating, "score" | "count">) => `★ ${r.score.toFixed(1)} (${r.count.toLocaleString("ko-KR")})`;

/** 평점 높은 순 — 평점 있는 곳(점수 → 리뷰 수) 먼저, 없는 곳은 원래 순서(거리순) 그대로 뒤에 */
export function sortByRating<T extends { rating?: PlaceRating | null }>(places: T[]): T[] {
  return places.map((p, i) => ({ p, i })).sort((a, b) => {
    const ra = a.p.rating, rb = b.p.rating;
    if (ra && rb) return rb.score - ra.score || rb.count - ra.count || a.i - b.i;
    if (ra) return -1;
    if (rb) return 1;
    return a.i - b.i;
  }).map((x) => x.p);
}
