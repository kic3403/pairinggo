/**
 * "요즘 많이 찾는 전통주" — 두 신호를 합친다.
 *  1) 우리 사이트 검색 로그 집계(popular_terms, 최근 30일, type=drink). 트래픽이 쌓이면 이게 1순위.
 *  2) 외부 트렌드(drinks.trend — 네이버 데이터랩 검색량·인스타·유튜브, 매월 갱신). 로그가 부족한 동안의 기준.
 * 사이트 로그는 검색 3회 이상인 술만 인정하고, 부족한 자리는 트렌드 순위로 채운다.
 */
import { D, POPULAR, type Drink } from "@pairinggo/shared";
import { db } from "./db";

const MIN_COUNT = 3;

export async function topDrinks(n = 10): Promise<{ list: Drink[]; basis: "site" | "trend" | "mixed" }> {
  const out: Drink[] = [];
  const seen = new Set<string>();
  const sb = db();
  if (sb) {
    const { data } = await sb.from("popular_terms").select("matched_id,count").eq("type", "drink").gte("count", MIN_COUNT).order("count", { ascending: false }).limit(n * 2);
    for (const r of data || []) {
      const d = r.matched_id ? D[r.matched_id] : undefined;
      if (d && !seen.has(d.id)) { seen.add(d.id); out.push(d); if (out.length >= n) break; }
    }
  }
  const fromSite = out.length;
  for (const d of POPULAR) { if (out.length >= n) break; if (!seen.has(d.id)) { seen.add(d.id); out.push(d); } }
  return { list: out, basis: fromSite === 0 ? "trend" : fromSite >= n ? "site" : "mixed" };
}
