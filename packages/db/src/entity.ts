/**
 * 이름 → 카탈로그 ID 매칭 (엑셀 가져오기·자동 수집 공용). shared 검색 엔진 재사용.
 *   exact: 정확/접두/별칭 일치 → 자동 확정
 *   fuzzy: 오타·부분 일치 → 후보에 넣되 needs_entity(검수에서 확정)
 *   none : 못 찾음
 */
import { search, normalize, FOOD_DOCS, type Doc } from "@pairinggo/shared";

export type Match = { id: string | null; name: string | null; confidence: "exact" | "fuzzy" | "none"; kind?: string };

export function matchEntity(raw: string, type: "drink" | "food"): Match {
  const q = (raw || "").trim();
  if (!q) return { id: null, name: null, confidence: "none" };
  const r = search(q, { types: [type], limit: 3 });
  const top = r.hits[0];
  if (!top) return { id: null, name: null, confidence: "none" };
  const strong = ["exact", "prefix"].includes(top.kind) || (top.kind === "contains" && normalize(q).length >= 3) || (top.field === "alias" && ["exact", "prefix"].includes(top.kind));
  return { id: top.doc.id, name: top.doc.name, confidence: strong ? "exact" : "fuzzy", kind: top.kind };
}

/** 본문에서 카탈로그 음식 이름·별칭을 최장 일치로 찾는다 (자동 수집용). 반환: 음식 id → 등장 위치 */
const FOOD_TERMS: { id: string; term: string }[] = FOOD_DOCS.flatMap((d: Doc) => [{ id: d.id, term: d.name }, ...(d.aliases.map((a) => ({ id: d.id, term: a.norm })))])
  .filter((t) => t.term.length >= 2).sort((a, b) => b.term.length - a.term.length);
export function findFoods(text: string): { id: string; index: number; term: string }[] {
  const out: { id: string; index: number; term: string }[] = [];
  const seen = new Set<string>();
  const plain = text.replace(/\s+/g, "");
  for (const t of FOOD_TERMS) {
    const key = t.term.replace(/\s+/g, "");
    const i = plain.indexOf(key);
    if (i >= 0 && !seen.has(t.id)) { seen.add(t.id); out.push({ id: t.id, index: i, term: t.term }); }
  }
  return out;
}

/** 이름 주변 ±n자 인용 (공백 제거 전 원문 기준으로 근사) */
export function snippetAround(text: string, term: string, n = 60): string {
  const i = text.indexOf(term);
  if (i < 0) return text.slice(0, n * 2).trim();
  return text.slice(Math.max(0, i - n), Math.min(text.length, i + term.length + n)).replace(/\s+/g, " ").trim();
}

export const stripHtml = (s: string) => (s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");
export const domainOf = (url?: string | null) => { try { return url ? new URL(url).hostname.replace(/^www\./, "") : null; } catch { return null; } };

/* ---------- 수집 결과 → 후보 (collect.ts · pilot.ts 공용) ---------- */
export type Hit = { kind: "blog" | "cafe" | "news" | "youtube"; title: string; desc: string; url: string; date?: string; author?: string };
export type Candidate = { drinkId: string; foodId: string; kind: Hit["kind"]; url: string; title: string; quote: string; query: string; tier: "media" | "blog"; sourceName: string };
/** 검색 결과 → 후보 (카탈로그 음식 이름이 제목·요약에 등장한 것만) */
export function extract(drinkId: string, query: string, hits: Hit[]): Candidate[] {
  const out: Candidate[] = [];
  for (const h of hits) {
    const text = `${h.title} ${h.desc}`;
    for (const f of findFoods(text)) {
      out.push({ drinkId, foodId: f.id, kind: h.kind, url: h.url, title: h.title, quote: snippetAround(text, f.term, 60).slice(0, 200), query, tier: h.kind === "news" ? "media" : "blog", sourceName: h.author || domainOf(h.url) || h.kind });
    }
  }
  return out;
}

