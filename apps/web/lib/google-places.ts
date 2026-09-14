/**
 * 구글 지도 평점(Places API (New) Text Search) — 카카오 식당 목록에 ★ 평점·리뷰 수를 붙인다. 서버 전용(GOOGLE_PLACES_KEY).
 *  · 대조 규칙은 shared place-rating.ts(pickGoogleMatch). 이름+좌표(반경 편향)로 찾고 150m 안의 같은 이름만 인정
 *  · 캐시는 DB place_ratings(0018) 30일 — 구글 정책이 place ID 외 데이터를 30일까지만 보관하게 한다. 대조 실패도 30일 기록
 *  · 평점 필드는 구글의 가장 비싼 등급(Enterprise, 월 1,000회 무료) → 한 요청에 최대 MAX_LOOKUPS곳만, 같은 프로세스 안에서 하루 DAILY_CAP회
 *  · 키가 없거나 DB가 없으면 조용히 건너뛴다(평점 없이 목록만)
 */
import { MIN_RATING_COUNT, pickGoogleMatch, type GoogleCandidate, type Place, type PlaceRating } from "@pairinggo/shared";
import { db } from "./db";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOOKUPS = 12;
const DAILY_CAP = 150;
let dayKey = "", dayCalls = 0;

export const googlePlacesConfigured = () => !!process.env.GOOGLE_PLACES_KEY;

type Row = { kakao_id: string; google_id: string | null; rating: number | null; count: number | null; fetched_at: string };

async function searchGoogle(place: Place): Promise<GoogleCandidate[]> {
  const key = process.env.GOOGLE_PLACES_KEY!;
  const today = new Date().toISOString().slice(0, 10);
  if (dayKey !== today) { dayKey = today; dayCalls = 0; }
  if (dayCalls >= DAILY_CAP) return [];
  dayCalls++;
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.location" },
    body: JSON.stringify({ textQuery: place.name, languageCode: "ko", regionCode: "KR", maxResultCount: 5, locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 500 } } }),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) { console.warn("[google-places]", r.status, (await r.text()).slice(0, 200)); return []; }
  const j = (await r.json()) as { places?: { id: string; displayName?: { text?: string }; rating?: number; userRatingCount?: number; location?: { latitude: number; longitude: number } }[] };
  return (j.places ?? []).filter((p) => p.location).map((p) => ({ id: p.id, name: p.displayName?.text ?? "", lat: p.location!.latitude, lng: p.location!.longitude, rating: p.rating ?? null, count: p.userRatingCount ?? 0 }));
}

/** 목록의 앞 MAX_LOOKUPS곳에 평점을 붙인다(캐시 우선, 없으면 구글). 실패는 조용히 */
export async function attachRatings(places: Place[]): Promise<Place[]> {
  const sb = db();
  if (!sb || !googlePlacesConfigured() || !places.length) return places;
  const targets = places.slice(0, MAX_LOOKUPS);
  const ids = targets.map((p) => p.id);
  const { data } = await sb.from("place_ratings").select("kakao_id,google_id,rating,count,fetched_at").in("kakao_id", ids);
  const cached = new Map<string, Row>();
  const now = Date.now();
  for (const r of (data ?? []) as Row[]) if (now - new Date(r.fetched_at).getTime() < TTL_MS) cached.set(r.kakao_id, r);

  const fresh: Row[] = [];
  await Promise.all(targets.filter((p) => !cached.has(p.id)).map(async (p) => {
    try {
      const m = pickGoogleMatch(p, await searchGoogle(p));
      const row: Row = { kakao_id: p.id, google_id: m?.id ?? null, rating: m?.rating ?? null, count: m?.count ?? null, fetched_at: new Date().toISOString() };
      cached.set(p.id, row); fresh.push(row);
    } catch (e) { console.warn("[google-places]", p.name, (e as Error).message); }
  }));
  if (fresh.length) await sb.from("place_ratings").upsert(fresh, { onConflict: "kakao_id" });

  return places.map((p) => {
    const r = cached.get(p.id);
    const rating: PlaceRating | null = r?.rating != null && (r.count ?? 0) >= MIN_RATING_COUNT ? { score: Number(r.rating), count: r.count!, source: "google", googleId: r.google_id ?? undefined } : null;
    return r ? { ...p, rating } : p;
  });
}
