/**
 * 식당 수상 표(restaurant_awards) — 배지 대조는 최신 연도만, 목록 화면(/michelin)은 최근 3개 연도.
 * 메모리 1시간 캐시. DB가 없으면 빈 배열. 표 갱신은 packages/db `awards` 스크립트(docs/17).
 */
import { matchAward, type Award, type AwardBadge } from "@pairinggo/shared";
import { db } from "./db";

export type AwardRow = Award & { cuisine?: string | null; price?: string | null };
export type Edition = { guide: string; year: number; edition: string | null; published: string | null; coverage: string | null; source: string | null };

const TTL = 60 * 60 * 1000;
let cache: { at: number; list: AwardRow[]; year: number | null; editions: Edition[]; all: AwardRow[] } | null = null;

async function load() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const sb = db();
  let all: AwardRow[] = [], editions: Edition[] = [];
  if (sb) {
    const [a, e] = await Promise.all([
      sb.from("restaurant_awards").select("guide,year,city,name,kind,level,lat,lng,url,cuisine,price").eq("guide", "michelin").order("year", { ascending: false }).limit(5000),
      sb.from("award_editions").select("guide,year,edition,published,coverage,source").eq("guide", "michelin").order("year", { ascending: false }),
    ]);
    all = (a.data || []) as AwardRow[];
    editions = (e.data || []) as Edition[];
  }
  const year = all.length ? Math.max(...all.map((x) => x.year)) : null;
  cache = { at: Date.now(), all, list: all.filter((x) => x.year === year), year, editions };
  return cache;
}

/** 배지 대조용 — 최신 연도 */
export async function loadAwards(): Promise<{ list: AwardRow[]; year: number | null }> { const c = await load(); return { list: c.list, year: c.year }; }
/** 목록 화면용 — 최근 n개 연도, 연도별 묶음 */
export async function loadAwardYears(n = 3): Promise<{ year: number; edition: Edition | null; rows: AwardRow[] }[]> {
  const c = await load();
  const years = [...new Set(c.all.map((x) => x.year))].sort((a, b) => b - a).slice(0, n);
  return years.map((year) => ({ year, edition: c.editions.find((e) => e.year === year) ?? null, rows: c.all.filter((x) => x.year === year) }));
}
export async function badgeFor(place: { name: string; lat?: number | null; lng?: number | null }): Promise<AwardBadge | null> {
  const { list } = await loadAwards();
  return list.length ? matchAward(place, list) : null;
}
