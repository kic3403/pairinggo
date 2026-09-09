import { intentSearch, normalize, search } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { error, json, preflight, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/v1/search?q= — 서버에서 같은 검색 엔진 실행 + search_logs 적재 (미니앱은 로컬 검색을 쓰고, 이 API는 공유·딥링크·외부 연동용) */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 80);
  if (!q) return error(req, 400, "q 파라미터가 필요합니다");
  await getCatalog(); // 서버 인덱스를 최신 카탈로그로
  const it = intentSearch(q, 10);
  const r = search(q, { limit: 10 });
  const summary = (h: { doc: { type: string; id: string; name: string; meta: string; kind?: string; key?: string } ; kind: string }) => ({ type: h.doc.type, id: h.doc.id, name: h.doc.name, meta: h.doc.meta, kind: h.doc.kind, key: h.doc.key, match: h.kind });
  const body = {
    q,
    intent: it ? {
      target: it.intent.target, explain: it.intent.explain, matchedSubjects: it.matchedSubjects,
      drinks: it.drinks.map((x) => ({ id: x.drink.id, name: x.drink.name, category: x.drink.category, score: Math.round(x.score), count: x.count, reason: x.via?.reason ?? null })),
      foods: it.foods.map((x) => ({ id: x.food.id, name: x.food.name, category: x.food.category, score: Math.round(x.score), count: x.count, reason: x.via?.reason ?? null })),
    } : null,
    drinks: r.drinks.map(summary), foods: r.foods.map(summary), browse: r.browse.map(summary),
    suggestions: r.suggestions.map((s) => ({ type: s.type, id: s.id, name: s.name })),
  };
  const sb = db();
  if (sb) {
    const top = r.hits[0];
    void sb.from("search_logs").insert({
      query_text: q, query_norm: normalize(q), kind: it ? "search_intent" : r.hits.length ? "search" : "search_empty",
      matched_type: it ? "intent" : top?.doc.type ?? null, matched_id: it ? null : top?.doc.id ?? null, session_id: null,
    }).then(({ error: e }) => { if (e) console.error("[search_logs]", e.message); });
  }
  return json(req, body, { headers: NO_CACHE });
}
export function OPTIONS(req: Request) { return preflight(req); }
