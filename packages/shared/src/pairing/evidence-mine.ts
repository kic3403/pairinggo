/**
 * 근거 늘리기(2026-09-27, docs/26 §3-5 3단계) — 모아 둔 후보 글(블로그·카페·뉴스·유튜브)과 양조장 공식 페이지에서
 * "이 술엔 이 음식이 어울린다"는 문장을 찾는다. 판정은 Claude(server/evidence-mine.ts), 여기는 앞뒤 규칙만.
 *   · 앞: 원문에서 술 이름과 음식 이름이 가까이(NEAR자 안) 함께 나오는 대목만 잘라 보낸다 — 함께 안 나오면 부르지 않는다(비용·오탐)
 *   · 뒤: Claude가 고른 인용문이 원문(또는 검색 요약)에 글자 그대로 있고 음식 이름을 담고 있어야 'yes'로 인정한다
 *         — 없으면 unclear(사람이 원문을 보고 판단). 광고·협찬 글도 unclear
 * 승인은 여전히 사람이 한다(어드민 검수 'AI 확인' 목록). 인정된 인용문이 근거 인용으로 쓰인다.
 */

/** 비교용 — 띄어쓰기·문장부호를 뺀 소문자 글자(한글·영문·숫자) */
export const squashText = (s: string) => String(s ?? "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/[^가-힣a-z0-9]/g, "");

/** 짝 잃은 서로게이트(이모지를 반으로 자른 조각) 지우기 — 그대로 보내면 API가 JSON 오류로 거절한다(2026-09-28 5건) */
export const wellFormed = (s: string) => s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");

export const MINE_NEAR = 400;
export const MINE_PAD = 220;
export const MINE_MAX_WINDOWS = 3;
export const MINE_WINDOW_MAX = 1000;

/** 이름 하나 → 띄어쓰기를 무시하는 정규식("한산 소곡주"도 "한산소곡주"로 찾는다) */
export function termPattern(term: string): RegExp | null {
  const chars = [...String(term ?? "").replace(/\s+/g, "")];
  if (chars.length < 2) return null;
  return new RegExp(chars.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"), "gi");
}

/** 본문에서 이름들이 나오는 자리(시작 위치) */
export function termPositions(text: string, terms: string[]): { at: number; len: number; term: string }[] {
  const out: { at: number; len: number; term: string }[] = [];
  for (const t of new Set(terms)) {
    const re = termPattern(t);
    if (!re) continue;
    for (const m of text.matchAll(re)) out.push({ at: m.index ?? 0, len: m[0].length, term: t });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** 이름에서 떼어도 되는 흔한 낱말(원문은 "원소주 스피릿"을 "원소주", "나루 생막걸리 6도"를 "나루 생막걸리"로 적는다) */
const GENERIC_WORDS = new Set(["막걸리", "생막걸리", "탁주", "약주", "청주", "소주", "증류주", "스피릿", "와인", "화이트", "레드", "로제", "드라이", "미디엄", "스위트", "스파클링", "리큐르", "원주"]);
const isGeneric = (s: string) => GENERIC_WORDS.has(squashText(s)) || /^\d+(도|%)?$/.test(squashText(s));

/** 정식 이름의 짧은 변형 — 끝의 도수(6도·25%) 떼기, 흔한 낱말 빼기. 흔한 낱말만 남거나 2자 미만이면 버린다 */
export function drinkNameVariants(name: string): string[] {
  const base = String(name ?? "").replace(/\s*\d+(\.\d+)?\s*(도|%)\s*$/, "").trim();
  const words = base.split(/\s+/).filter(Boolean);
  const out = new Set<string>([base]);
  const core = words.filter((w) => !GENERIC_WORDS.has(w));
  if (core.length && core.length < words.length) out.add(core.join(" "));
  if (words.length >= 2 && GENERIC_WORDS.has(words[words.length - 1])) out.add(words.slice(0, -1).join(" "));
  return [...out].filter((x) => squashText(x).length >= 2 && !isGeneric(x));
}

/** 수집 검색어의 따옴표 구절 — '"이바비 막걸리" 페어링' → ["이바비 막걸리"] (그 글을 찾은 이름) */
export function queryPhrases(query: string | null | undefined): string[] {
  return [...String(query ?? "").matchAll(/"([^"]{2,40})"/g)].map((m) => m[1].trim()).filter((x) => squashText(x).length >= 2 && !isGeneric(x));
}

/** 술 이름 후보 — 이름·짧은 변형 + 별칭(양조장 이름과 같은 별칭은 뺀다: 양조장의 다른 술 글에도 걸린다) + 수집 검색어 구절 */
export function drinkTermsOf(d: { name: string; alias?: string | string[] | null; aliases?: string[] | null; brewery?: string | null }, queries: (string | null | undefined)[] = []): string[] {
  const brewery = squashText(d.brewery ?? "");
  const alias = [...(d.aliases ?? []), ...(Array.isArray(d.alias) ? d.alias : d.alias ? [d.alias] : [])].map((s) => String(s ?? "").trim()).filter((s) => s && squashText(s).length >= 2 && !isGeneric(s) && (!brewery || squashText(s) !== brewery));
  const out = [...drinkNameVariants(d.name), d.name.trim(), ...alias, ...queries.flatMap(queryPhrases)];
  return [...new Set(out.filter((s) => squashText(s).length >= 2))];
}
export function foodTermsOf(f: { name: string; alias?: string[] | null }): string[] {
  return [...new Set([f.name, ...(f.alias ?? [])].map((s) => String(s ?? "").trim()).filter((s) => squashText(s).length >= 2))];
}

/**
 * 술 이름과 음식 이름이 near자 안에 함께 나오는 대목(앞뒤 pad자 포함) — 가까운 것부터 최대 max개, 겹치면 합친다.
 * 음식 이름이 술 이름 속에 있으면(딸기막걸리의 딸기) 그 자리는 음식으로 치지 않는다.
 */
export function coMentionWindows(text: string, drinkTerms: string[], foodTerms: string[], opts: { near?: number; pad?: number; max?: number } = {}): string[] {
  const near = opts.near ?? MINE_NEAR, pad = opts.pad ?? MINE_PAD, max = opts.max ?? MINE_MAX_WINDOWS;
  const t = String(text ?? "").replace(/\s+/g, " ");
  const dp = termPositions(t, drinkTerms);
  if (!dp.length) return [];
  const drinkSpans = dp.map((p) => [p.at, p.at + p.len] as const);
  const fp = termPositions(t, foodTerms).filter((p) => !drinkSpans.some(([a, b]) => p.at >= a && p.at < b));
  const pairs: { a: number; b: number; gap: number }[] = [];
  for (const d of dp) for (const f of fp) {
    const gap = Math.abs(d.at - f.at);
    if (gap <= near) pairs.push({ a: Math.min(d.at, f.at), b: Math.max(d.at + d.len, f.at + f.len), gap });
  }
  if (!pairs.length) return [];
  pairs.sort((x, y) => x.gap - y.gap);
  const spans: [number, number][] = [];
  for (const p of pairs) {
    const s = Math.max(0, p.a - pad), e = Math.min(t.length, p.b + pad);
    const hit = spans.find(([a, b]) => s <= b && e >= a);
    if (hit) { hit[0] = Math.min(hit[0], s); hit[1] = Math.max(hit[1], e); }
    else if (spans.length < max) spans.push([s, e]);
  }
  return spans.sort((x, y) => x[0] - y[0]).map(([s, e]) => wellFormed(t.slice(s, Math.min(e, s + MINE_WINDOW_MAX))).trim());
}

/** 추천·어울림을 말하는 낱말 — 공식 페이지에서 볼 대목을 고를 때 */
export const PAIRING_WORDS = /(어울|안주|곁들|페어링|pairing|함께\s*(드|먹|즐기|마시)|잘\s*맞|궁합|추천\s*음식|마리아주)/i;

/** 공식 페이지 — 추천 낱말 앞뒤 대목(음식 이름을 몰라도 찾는다) */
export function pairingWordWindows(text: string, opts: { pad?: number; max?: number } = {}): string[] {
  const pad = opts.pad ?? 260, max = opts.max ?? 4;
  const t = String(text ?? "").replace(/\s+/g, " ");
  const re = new RegExp(PAIRING_WORDS.source, "gi");
  const spans: [number, number][] = [];
  for (const m of t.matchAll(re)) {
    const s = Math.max(0, (m.index ?? 0) - pad), e = Math.min(t.length, (m.index ?? 0) + pad);
    const hit = spans.find(([a, b]) => s <= b && e >= a);
    if (hit) { hit[0] = Math.min(hit[0], s); hit[1] = Math.max(hit[1], e); }
    else if (spans.length < max) spans.push([s, e]);
  }
  return spans.map(([s, e]) => wellFormed(t.slice(s, Math.min(e, s + MINE_WINDOW_MAX))).trim());
}

/** 인용문이 원문 어딘가에 글자 그대로 있나(띄어쓰기·문장부호 무시, 10자 이상) */
export function quoteVerbatim(quote: string | null | undefined, sources: string[]): boolean {
  const q = squashText(String(quote ?? "").replace(/…|\.\.\./g, " "));
  if (q.length < 10) return false;
  return sources.some((s) => squashText(s).includes(q));
}

/** 인용문에 음식 이름이 들어 있나(별칭 포함) */
export const quoteHasTerm = (quote: string | null | undefined, terms: string[]) => {
  const q = squashText(quote ?? "");
  return terms.some((t) => { const k = squashText(t); return k.length >= 2 && q.includes(k); });
};

export type MineVerdict = "yes" | "no" | "unclear";
export type MineRaw = { verdict: MineVerdict; quote: string; reason: string; ad: boolean };
export type MineFinal = { verdict: MineVerdict; quote: string | null; reason: string | null; note: string };

/** Claude 판정 → 저장할 판정. 'yes'는 인용문이 원문에 그대로 있고 음식 이름을 담을 때만 */
export function finalizeMine(raw: MineRaw, ctx: { sources: string[]; foodTerms: string[] }): MineFinal {
  const quote = String(raw.quote ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
  const reason = String(raw.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || null;
  if (raw.verdict !== "yes") return { verdict: raw.verdict === "no" ? "no" : "unclear", quote, reason, note: raw.verdict === "no" ? "AI: 어울린다는 말이 없음" : "AI: 판단 어려움" };
  if (raw.ad) return { verdict: "unclear", quote, reason, note: "광고·협찬 표시가 있는 글" };
  if (!quote || !quoteVerbatim(quote, ctx.sources)) return { verdict: "unclear", quote, reason, note: "인용문이 원문에 그대로 없음" };
  if (!quoteHasTerm(quote, ctx.foodTerms)) return { verdict: "unclear", quote, reason, note: "인용문에 음식 이름이 없음" };
  return { verdict: "yes", quote, reason, note: "" };
}

/** HTML → 읽을 글자(문단·줄바꿈은 한 칸, 흔한 엔티티 풀기). 스크립트·스타일은 가져오는 쪽에서 이미 뺀다 */
export function htmlToText(html: string): string {
  return String(html ?? "")
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : " "; })
    .replace(/[ \t ​]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}
