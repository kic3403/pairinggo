/**
 * 이름 → 카탈로그 ID 매칭 (엑셀 가져오기·자동 수집 공용). shared 검색 엔진 재사용.
 *   exact: 정확/접두/별칭 일치 → 자동 확정
 *   fuzzy: 오타·부분 일치 → 후보에 넣되 needs_entity(검수에서 확정)
 *   none : 못 찾음
 */
import { search, normalize, FOOD_DOCS, DRINK_DOCS, DATA, type Doc } from "@pairinggo/shared";

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
  // 술 이름 속 음식 낱말은 음식이 아니다(딸기막걸리의 '딸기' → 제철 과일 오탐) — 술 이름 자리를 먼저 지운다
  let plain = text.replace(/\s+/g, "");
  for (const t of DRINK_NAME_TERMS) if (plain.includes(t)) plain = plain.split(t).join("□".repeat(t.length));
  for (const t of FOOD_TERMS) {
    const key = t.term.replace(/\s+/g, "");
    const i = plain.indexOf(key);
    if (i >= 0 && !seen.has(t.id)) { seen.add(t.id); out.push({ id: t.id, index: i, term: t.term }); }
  }
  return out;
}

/* ---------- 본문 → 술 (음식 기준 수집용) ---------- */
// 양조장 이름처럼 여러 술에 걸린 말, 흔한 낱말, 일반 술(generic)은 빼고, 3자 미만은 이름이 뚜렷한 것만
const DRINK_STOP = new Set(["우리술", "좋은술", "대대로", "허니문", "까치설", "술소리", "벗드림", "그린", "담을", "낙천", "화주", "수록", "오희", "예담", "능화", "제이1", "제이엘", "담솔", "니모메",
  // 여러 양조장이 쓰는 일반 이름
  "밤막걸리", "딸기막걸리", "복숭아와인", "한국와인", "안동소주", "남도탁주"]);
/** 가격 표기(10,000원 소주 → '원소주' 오탐)를 지운다 */
const stripPrices = (t: string) => t.replace(/\d[\d,.]*\s*원/g, "₩");
// 2자 이름은 흔한 말 속에 섞인다(화요 → 중화요리·화요일) — 허용 목록을 비워 둔다
const DRINK_SHORT_OK = new Set<string>();
const GENERIC_DRINK = new Set(DATA.drinks.filter((d) => d.generic).map((d) => d.id));
const termOwners = new Map<string, Set<string>>();
for (const d of DRINK_DOCS as Doc[]) for (const t of [d.name, ...d.aliases.map((a) => a.norm)]) {
  const k = t.replace(/\s+/g, ""); if (!k) continue;
  if (!termOwners.has(k)) termOwners.set(k, new Set());
  termOwners.get(k)!.add(d.id);
}
/** 음식 찾기 전에 지울 술 이름(4자 이상 — '딸기막걸리' 등) */
const DRINK_NAME_TERMS = [...termOwners.keys()].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length);
const DRINK_TERMS: { id: string; term: string }[] = [...termOwners.entries()]
  .filter(([k, ids]) => ids.size === 1 && !DRINK_STOP.has(k) && (k.length >= 3 || DRINK_SHORT_OK.has(k)))
  .map(([k, ids]) => ({ id: [...ids][0], term: k }))
  .filter((t) => !GENERIC_DRINK.has(t.id))
  .sort((a, b) => b.term.length - a.term.length);
/** 본문에서 카탈로그 술 이름·별칭을 최장 일치로 찾는다. 긴 이름이 잡힌 자리는 지워 짧은 별칭이 겹쳐 잡히지 않게 */
export function findDrinks(text: string): { id: string; term: string }[] {
  let plain = stripPrices(text).replace(/\s+/g, "");
  const out: { id: string; term: string }[] = []; const seen = new Set<string>();
  for (const t of DRINK_TERMS) {
    if (!plain.includes(t.term)) continue;
    plain = plain.split(t.term).join("□".repeat(t.term.length));
    if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
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
export const NEAR_CHARS = 30;
const indicesOf = (hay: string, needle: string) => { const out: number[] = []; for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) out.push(i); return out; };
/**
 * 음식 기준 검색 결과 → 후보 — 그 음식 이름(별칭)과 카탈로그 술 이름이 **가까이**(공백 뺀 NEAR_CHARS=30자 이내, 사이에 '…' 없음) 함께 나온 것만.
 * 뉴스 요약은 서로 다른 문단을 '…'로 이어 붙여 신상품 목록에 술·음식이 우연히 같이 걸리기 쉽다.
 */
export function extractForFood(foodId: string, query: string, hits: Hit[]): Candidate[] {
  const out: Candidate[] = [];
  const foodTerms = [...new Set(FOOD_TERMS.filter((t) => t.id === foodId).map((t) => t.term.replace(/s+/g, "")))];
  for (const h of hits) {
    const text = stripPrices(`${h.title} ${h.desc}`);
    if (!findFoods(text).some((x) => x.id === foodId)) continue;
    const raw = text.replace(/\s+/g, "");
    let blanked = raw;
    for (const t of DRINK_NAME_TERMS) if (blanked.includes(t)) blanked = blanked.split(t).join("□".repeat(t.length));
    const foodSpans = foodTerms.flatMap((t) => indicesOf(blanked, t).map((i) => [i, i + t.length] as const));
    const food = FOOD_TERMS.find((t) => t.id === foodId && text.includes(t.term)) ?? FOOD_TERMS.find((t) => t.id === foodId)!;
    for (const d of findDrinks(text)) {
      const near = indicesOf(raw, d.term).some((di) => foodSpans.some(([fs, fe]) => {
        const [a, b] = di < fs ? [di + d.term.length, fs] : [fe, di];
        if (b - a > NEAR_CHARS) return false;
        const between = raw.slice(Math.min(a, b), Math.max(a, b));
        return !between.includes("…") && !between.includes("...");
      }));
      if (!near) continue;
      const around = snippetAround(text, food.term, 60);
      const quote = around.replace(/\s+/g, "").includes(d.term) ? around : `${snippetAround(text, food.term, 30)} … ${snippetAround(text, d.term, 30)}`;
      out.push({ drinkId: d.id, foodId, kind: h.kind, url: h.url, title: h.title, quote: quote.slice(0, 200), query, tier: h.kind === "news" ? "media" : "blog", sourceName: h.author || domainOf(h.url) || h.kind });
    }
  }
  return out;
}

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

