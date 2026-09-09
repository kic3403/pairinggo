/**
 * 별점 정렬용 보정 점수 (베이지안 평균) — Phase 3 앱 내 식당 리스트에서 사용.
 * 리뷰 1개짜리 5.0이 리뷰 500개짜리 4.6을 이기지 못하도록,
 * 리뷰 수가 적을수록 전체 평균(C)에 가깝게 당긴다.
 *   score = (v / (v + m)) * R + (m / (v + m)) * C
 */
export const RATING_PRIOR_MEAN = 4.0;
export const RATING_MIN_VOTES = 20;

export function bayesianScore(rating: number | null | undefined, votes: number | null | undefined) {
  const R = rating ?? 0, v = votes ?? 0, m = RATING_MIN_VOTES, C = RATING_PRIOR_MEAN;
  if (!R) return 0;
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371, dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type Restaurant = {
  id: string; name: string; address: string; rating: number | null; ratingCount: number;
  score: number; distanceKm: number | null; lat: number; lng: number;
  phone: string | null; openNow: boolean | null; mapsUrl: string | null; naverUrl: string;
};
