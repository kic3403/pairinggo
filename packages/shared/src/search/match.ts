/**
 * 이름 매칭 — 정확 > 접두 > 부분 > 자모 접두(조합 중) > 초성 > 오타(자모 편집거리).
 * 필드 가중: 이름 1.0 · 별칭 0.9 · 양조장 0.7 · 종류/태그/지역 0.6.
 * 최종 점수 = 매칭 점수 + 트렌드×8 + 수상 3. 동률은 이름 짧은 순.
 */
import { choseong, isChoseongOnly, toJamo } from "../hangul";
import { DOCS, type Doc, type DocType } from "./docs";
import { categoryOf, normalize, stripSuffix } from "./normalize";

export type MatchKind = "exact" | "prefix" | "contains" | "jamo-prefix" | "jamo-contains" | "chosung" | "fuzzy" | "field";
export type Hit = { doc: Doc; score: number; kind: MatchKind; field: "name" | "alias" | "brewery" | "category" | "tag" | "region" };

/** 제한 편집거리 (Levenshtein). max를 넘으면 max+1 반환 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length] > max ? max + 1 : prev[b.length];
}

/** 자모 편집거리 허용치: 검색어 음절 3개 이하 → 1, 그 이상 → 2 */
const allowedDistance = (syllables: number) => (syllables <= 3 ? 1 : 2);

function nameScore(qNorm: string, qJamo: string, qCho: boolean, target: { norm: string; jamo: string; cho?: string }, syllables: number): { score: number; kind: MatchKind } | null {
  if (!target.norm) return null;
  if (target.norm === qNorm) return { score: 100, kind: "exact" };
  if (target.norm.startsWith(qNorm)) return { score: 90, kind: "prefix" };
  if (target.norm.includes(qNorm)) return { score: 75, kind: "contains" };
  if (qCho && target.cho) {
    if (target.cho.startsWith(qNorm)) return { score: 68, kind: "chosung" };
    if (target.cho.includes(qNorm)) return { score: 65, kind: "chosung" };
    return null;
  }
  if (qJamo.length >= 2) {
    if (target.jamo.startsWith(qJamo)) return { score: 70, kind: "jamo-prefix" };
    if (target.jamo.includes(qJamo)) return { score: 60, kind: "jamo-contains" };
  }
  // 오타: 검색어 자모열 vs 대상 이름(또는 같은 길이의 접두 창) 자모열
  if (syllables >= 2) {
    const max = allowedDistance(syllables);
    const window = target.jamo.slice(0, Math.min(target.jamo.length, qJamo.length + max));
    const d = Math.min(editDistance(qJamo, target.jamo, max), editDistance(qJamo, window, max));
    if (d <= max) return { score: 50 - d * 10, kind: "fuzzy" };
  }
  return null;
}

export type SearchOptions = { limit?: number; types?: DocType[] };
export type SearchResult = {
  q: string; norm: string;
  hits: Hit[];
  drinks: Hit[]; foods: Hit[]; browse: Hit[];
  /** 결과가 없을 때 "혹시 이걸 찾으셨나요" */
  suggestions: Doc[];
};

/** 검색어 하나로 술·음식·둘러보기 항목을 찾는다 */
export function search(q: string, opts: SearchOptions = {}): SearchResult {
  const limit = opts.limit ?? 12;
  const raw = q.trim();
  const empty: SearchResult = { q: raw, norm: "", hits: [], drinks: [], foods: [], browse: [], suggestions: [] };
  if (!raw) return empty;
  let norm = normalize(raw);
  if (!norm) return empty;
  const stripped = stripSuffix(norm);
  const qCho = isChoseongOnly(norm);
  const syllables = [...norm].filter((c) => /[가-힣]/.test(c)).length;
  const variants = stripped !== norm ? [norm, stripped] : [norm];
  const cat = categoryOf(norm) || categoryOf(stripped);
  const types = opts.types;

  const best = new Map<string, Hit>();
  const put = (doc: Doc, score: number, kind: MatchKind, field: Hit["field"]) => {
    const key = doc.type + ":" + doc.id;
    // 둘러보기(종류·지역·양조장)는 같은 이름의 술보다 뒤에 오도록 0.85 가중 ("복순도가" → 술이 먼저, 양조장은 그 다음)
    const base = doc.type === "browse" ? score * 0.85 : score;
    const total = base + doc.trend * 8 + (doc.fields.awards ? 3 : 0);
    const cur = best.get(key);
    if (!cur || cur.score < total) best.set(key, { doc, score: total, kind, field });
  };

  for (const doc of DOCS) {
    if (types && !types.includes(doc.type)) continue;
    for (const v of variants) {
      const vj = toJamo(v);
      const s = nameScore(v, vj, qCho, doc, syllables);
      if (s) put(doc, s.score, s.kind, "name");
      for (const a of doc.aliases) {
        const sa = nameScore(v, vj, qCho, { norm: a.norm, jamo: a.jamo, cho: choseong(a.norm) }, syllables);
        if (sa) put(doc, sa.score * 0.9, sa.kind, "alias");
      }
      if (doc.type === "drink" && doc.fields.brewery && v.length >= 2 && doc.fields.brewery.includes(v)) put(doc, 75 * 0.7, "field", "brewery");
      // 종류 동의어("막걸리") → 그 종류의 술 전부 (낮은 점수, 트렌드로 정렬)
      if (cat && doc.type === "drink" && doc.fields.category === normalize(cat)) put(doc, 40, "field", "category");
      if (!cat && v.length >= 2 && doc.type !== "browse" && doc.fields.category === v) put(doc, 40, "field", "category");
      if (v.length >= 2 && doc.fields.tags.some((t) => t === v)) put(doc, 36, "field", "tag");
      if (doc.type === "drink" && v.length >= 2 && doc.fields.region.includes(v)) put(doc, 34, "field", "region");
    }
  }
  // 여러 단어("복순도가 막걸리", "울주 탁주"): 단어별로 각각 어느 필드에든 맞으면 AND 매칭 (최소 점수 × 0.9)
  const tokens = raw.split(/\s+/).map(normalize).filter((t) => t.length >= 1);
  if (tokens.length >= 2) {
    for (const doc of DOCS) {
      if (types && !types.includes(doc.type)) continue;
      if (doc.type === "browse") continue;
      let minScore = Infinity;
      for (const t of tokens) {
        const tj = toJamo(t);
        const tc = categoryOf(t);
        let s = 0;
        const ns = nameScore(t, tj, isChoseongOnly(t), doc, [...t].filter((c) => /[가-힣]/.test(c)).length);
        if (ns) s = Math.max(s, ns.score);
        for (const a of doc.aliases) { const as = nameScore(t, tj, false, { norm: a.norm, jamo: a.jamo }, 0); if (as) s = Math.max(s, as.score * 0.9); }
        if (tc && doc.fields.category === normalize(tc)) s = Math.max(s, 70);
        if (doc.fields.category === t) s = Math.max(s, 70);
        if (doc.fields.tags.includes(t)) s = Math.max(s, 60);
        if (t.length >= 2 && doc.fields.region.includes(t)) s = Math.max(s, 60);
        if (t.length >= 2 && doc.fields.brewery.includes(t)) s = Math.max(s, 65);
        if (s < minScore) minScore = s;
        if (!s) break;
      }
      if (minScore > 0 && minScore !== Infinity) put(doc, minScore * 0.9, "contains", "name");
    }
  }
  // 종류 동의어는 둘러보기 항목을 최상단으로
  if (cat) {
    const browse = DOCS.find((d) => d.type === "browse" && d.kind === "category" && d.key === cat);
    if (browse && (!types || types.includes("browse"))) put(browse, 100, "exact", "name");
  }

  const hits = [...best.values()].sort((a, b) => b.score - a.score || a.doc.name.length - b.doc.name.length);
  const drinks = hits.filter((h) => h.doc.type === "drink").slice(0, limit);
  const foods = hits.filter((h) => h.doc.type === "food").slice(0, limit);
  const browse = hits.filter((h) => h.doc.type === "browse").slice(0, 6);
  const suggestions = hits.length ? [] : suggest(norm, 3);
  return { q: raw, norm, hits: hits.slice(0, limit), drinks, foods, browse, suggestions };
}

/** 결과가 없을 때: 자모 편집거리가 가까운 이름 n개 (술·음식만) */
export function suggest(norm: string, n = 3): Doc[] {
  const qj = toJamo(norm);
  if (qj.length < 2) return [];
  const max = Math.max(2, Math.floor(qj.length / 3));
  const scored: { doc: Doc; d: number }[] = [];
  for (const doc of DOCS) {
    if (doc.type === "browse") continue;
    // 이름 전체 · 이름의 검색어 길이 접두 창 · 별칭 중 가장 가까운 거리
    const targets = [doc.jamo, doc.jamo.slice(0, qj.length), ...doc.aliases.map((a) => a.jamo)];
    let d = max + 1;
    for (const t of targets) { const e = editDistance(qj, t, max); if (e < d) d = e; }
    if (d <= max) scored.push({ doc, d });
  }
  return scored.sort((a, b) => a.d - b.d || b.doc.trend - a.doc.trend).slice(0, n).map((s) => s.doc);
}
