/**
 * "요즘 많이 찾는 전통주" — drinks.trend.rank 순. 순위는 매일 00:00(KST) /api/cron/mentions 가
 * 인스타·유튜브·네이버 블로그·구글 블로그 최근 30일 언급량으로 다시 매긴다(packages/shared/src/trend.ts).
 * 설명 문구는 catalog_meta.trend_meta.note (크론이 쓴다).
 */
import type { Dataset, Drink } from "@pairinggo/shared";

export function topDrinks(ds: Dataset, n = 10): { list: Drink[]; note: string } {
  const list = ds.drinks.filter((d) => d.trend?.rank).sort((a, b) => a.trend!.rank! - b.trend!.rank!).slice(0, n);
  const note = (ds.trend_meta?.note || "").replace(/<[^>]+>/g, "");
  return { list, note };
}
