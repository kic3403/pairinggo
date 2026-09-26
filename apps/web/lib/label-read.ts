/**
 * 라벨 사진으로 찾기(docs/25 §5) — Claude가 읽은 이름을 카탈로그와 대조한다(shared search: 부분 일치·오타까지).
 * 결과가 없으면 search_logs에 search_empty(matched_type 'label')로 남겨 '없는 술' 대기열에 오르게 한다.
 */
import { readLabelImage, type LabelReadResult } from "@pairinggo/server/label-read";
import type { MenuImageType } from "@pairinggo/server/menu-read";
import { normalize, search, toSlug } from "@pairinggo/shared";
import { getCatalog } from "./catalog";
import { db } from "./db";

export { labelReadConfigured } from "@pairinggo/server/label-read";
/** 하루 전체 상한 — Claude 호출 비용 보호(사진 한 장 = 호출 한 번) */
export const LABEL_READS_PER_DAY = 300;

export type LabelMatch = { id: string; name: string; meta: string; href: string; exact: boolean };
export type LabelSearchResult = { read: Omit<LabelReadResult, "model">; matches: LabelMatch[]; query: string };

export async function labelReadsToday(): Promise<number> {
  const sb = db();
  if (!sb) return 0;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await sb.from("search_logs").select("id", { count: "exact", head: true }).in("matched_type", ["label", "label-hit"]).gte("created_at", since);
  return count ?? 0;
}

export async function labelSearch(image: { type: MenuImageType; data: string }, userId: string | null): Promise<LabelSearchResult> {
  const c = await getCatalog();
  const { model: _m, ...read } = await readLabelImage(image, c.dataset.drinks.map((d) => d.name));
  const candidates = [...(read.catalogName ? [read.catalogName] : []), ...read.names];
  const seen = new Set<string>();
  const matches: LabelMatch[] = [];
  for (const n of candidates) {
    const r = search(n, { limit: 3, types: ["drink"] });
    for (const h of r.drinks) {
      if (h.score < 55 || seen.has(h.doc.id)) continue;   // 오타 수준(50 미만)은 제외
      seen.add(h.doc.id);
      matches.push({ id: h.doc.id, name: h.doc.name, meta: h.doc.meta, href: `/drinks/${toSlug(h.doc.name)}`, exact: !!read.catalogName && h.doc.name === read.catalogName });   // "라벨과 같은 제품"은 Claude가 목록에서 고른 이름 그대로일 때만
    }
    if (matches.length >= 5) break;
  }
  const query = read.names[0] ?? read.catalogName ?? "";
  // 기록 — 못 찾은 이름은 '없는 술' 대기열로(search_empty), 찾은 것은 label-hit
  const sb = db();
  if (sb && query) {
    await sb.from("search_logs").insert({
      query_text: query, query_norm: normalize(query), kind: matches.length ? "search" : "search_empty",
      matched_type: matches.length ? "label-hit" : "label", matched_id: matches[0]?.id ?? null, user_id: userId,
    }).then(({ error }) => { if (error) console.warn("[label-read] log", error.message); });
  }
  return { read, matches: matches.slice(0, 5), query };
}
