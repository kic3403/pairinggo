/**
 * 식당 수상 표(restaurant_awards) — 최신 연도만 메모리에 1시간 캐시해 카카오 결과에 배지를 붙인다.
 * DB가 없으면 빈 배열(배지 없음). 표 갱신은 packages/db `awards` 스크립트(docs/17).
 */
import { matchAward, type Award, type AwardBadge } from "@pairinggo/shared";
import { db } from "./db";

const TTL = 60 * 60 * 1000;
let cache: { at: number; list: Award[]; year: number | null } | null = null;

export async function loadAwards(): Promise<{ list: Award[]; year: number | null }> {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const sb = db();
  let list: Award[] = [], year: number | null = null;
  if (sb) {
    const latest = await sb.from("restaurant_awards").select("year").eq("guide", "michelin").order("year", { ascending: false }).limit(1).maybeSingle();
    year = latest.data?.year ?? null;
    if (year) {
      const { data } = await sb.from("restaurant_awards").select("guide,year,city,name,kind,level,lat,lng,url").eq("guide", "michelin").eq("year", year).limit(2000);
      list = (data || []) as Award[];
    }
  }
  cache = { at: Date.now(), list, year };
  return cache;
}

export async function badgeFor(place: { name: string; lat?: number | null; lng?: number | null }): Promise<AwardBadge | null> {
  const { list } = await loadAwards();
  return list.length ? matchAward(place, list) : null;
}
