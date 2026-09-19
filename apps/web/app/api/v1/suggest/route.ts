import { search, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { json, preflight } from "@/lib/http";
import { rateLimit } from "@/lib/kakao";

export const runtime = "nodejs";
const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

export async function OPTIONS(req: Request) { return preflight(req); }

export type SuggestItem = { type: "drink" | "food" | "browse"; id: string; name: string; meta: string; href: string };

/**
 * GET /api/v1/suggest?q=복순 — 검색창 자동완성(2026-09-19). 술·음식·종류/양조장 후보.
 * 검색 엔진(shared search)이 부분 일치·입력 중인 한글(자모)·초성(ㅂㅅㄷ)·오타까지 본다. 카탈로그만 쓰므로 외부 호출 없음.
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 120, "suggest")) return json(req, { items: [] }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 40);
  if (!q) return json(req, { q, items: [] }, { headers: CACHE });
  await getCatalog();
  const r = search(q, { limit: 5 });
  const href = (t: string, name: string, kind?: string, key?: string) =>
    t === "drink" ? `/drinks/${toSlug(name)}` : t === "food" ? `/foods/${toSlug(name)}`
      : kind === "category" ? `/drinks?category=${encodeURIComponent(key || "")}` : kind === "region" ? `/drinks?region=${encodeURIComponent(key || "")}` : `/drinks?brewery=${encodeURIComponent(key || "")}`;
  const pick = (hits: typeof r.drinks, n: number): SuggestItem[] =>
    hits.slice(0, n).map((h) => ({ type: h.doc.type as SuggestItem["type"], id: h.doc.id, name: h.doc.name, meta: h.doc.meta, href: href(h.doc.type, h.doc.name, h.doc.kind, h.doc.key) }));
  // 자동완성은 짧게: 술 4 · 음식 4 · 종류/양조장 2
  const items = [...pick(r.drinks, 4), ...pick(r.foods, 4), ...pick(r.browse, 2)];
  return json(req, { q, items }, { headers: CACHE });
}
