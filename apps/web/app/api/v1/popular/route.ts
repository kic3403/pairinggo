import { getCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { json, preflight, PUBLIC_CACHE } from "@/lib/http";

export const runtime = "nodejs";

type Term = { term: string; type: string; id: string | null; name: string; count: number };

/** GET /api/v1/popular — 검색 로그 집계(popular_terms) 상위. 없으면 트렌드 순위 폴백 */
export async function GET(req: Request) {
  const c = await getCatalog();
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d])), F = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const sb = db();
  let drinks: Term[] = [], foods: Term[] = [], source: "logs" | "trend" = "trend";
  let computedAt: string | null = null;
  if (sb) {
    const { data } = await sb.from("popular_terms").select("term,type,matched_id,count,computed_at").order("count", { ascending: false }).limit(50);
    if (data?.length) {
      source = "logs"; computedAt = data[0].computed_at;
      for (const r of data) {
        if (r.type === "drink" && r.matched_id && D.has(r.matched_id) && drinks.length < 10 && !drinks.some((x) => x.id === r.matched_id)) drinks.push({ term: r.term, type: "drink", id: r.matched_id, name: D.get(r.matched_id)!.name, count: r.count });
        if (r.type === "food" && r.matched_id && F.has(r.matched_id) && foods.length < 10 && !foods.some((x) => x.id === r.matched_id)) foods.push({ term: r.term, type: "food", id: r.matched_id, name: F.get(r.matched_id)!.name, count: r.count });
      }
    }
  }
  const byRank = <T extends { trend?: { rank?: number } }>(xs: T[]) => xs.filter((x) => x.trend?.rank).sort((a, b) => a.trend!.rank! - b.trend!.rank!).slice(0, 10);
  if (!drinks.length) { source = "trend"; drinks = byRank(c.dataset.drinks).map((d) => ({ term: d.name, type: "drink", id: d.id, name: d.name, count: Math.round(d.trend?.score || 0) })); }
  if (!foods.length) foods = byRank(c.dataset.foods).map((f) => ({ term: f.name, type: "food", id: f.id, name: f.name, count: Math.round(f.trend?.score || 0) }));
  return json(req, { source, computedAt, drinks, foods }, { headers: { ...PUBLIC_CACHE, "x-pairinggo-source": c.source } });
}
export function OPTIONS(req: Request) { return preflight(req); }
