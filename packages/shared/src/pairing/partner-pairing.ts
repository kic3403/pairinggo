/**
 * 파트너 페어링 입력(2026-09-26, docs/25 §2 · 2026-09-29 확장) — 파트너가 "우리 술에 어울리는 음식"을 적으면 검수 없이 official 근거로 게시된다.
 *  · 양조장: 우리 양조장 술(카탈로그 id) × **음식은 직접 입력**(2026-09-29 사용자 결정) — 근거 "○○ 제공"
 *  · 식당(2026-09-29): 우리 술 표의 술 × 우리 메뉴(둘 다 고르거나 직접 입력) — 근거 "○○ 추천", 등급은 양조장과 같은 official(사용자 결정)
 *  · 적은 글자가 원본. 카탈로그와 자동 연결(resolveFoodText·resolveDrinkText)되면 pairings에 근거 한 줄, 안 되면 추천 칸(술·매장 상세·검색)에만
 *  · 손님 검색은 비슷한 음식이면 찾는다(foodSimilarity: 같은 음식 → 글자 포함 → 같은 분류)
 */
import { josa } from "../hangul";
import { firstSentence } from "../seo/share-card";
import { FOOD_CATEGORY_WORDS } from "../search/intent";

export const PARTNER_PAIRING_MAX_PER_DRINK = 8;
/** 식당은 매장 전체 상한(여러 술 × 여러 메뉴라 술당 상한만으로는 부족) */
export const PARTNER_PAIRING_MAX_TOTAL = 40;
export const PARTNER_FOOD_TEXT_MAX = 30;
export const PARTNER_DRINK_TEXT_MAX = 40;
export const PARTNER_PAIRING_NOTE_MAX = 120;
/** 양조장 공식 근거의 바닥 점수 — 카탈로그 official 행의 최소값(90)과 같다 */
export const PARTNER_PAIRING_ES = 90;
/** 빠른 입력 추천(2026-10-03) — 술마다 보여 줄 추천 조합 수 */
export const PARTNER_SUGGEST_PER_DRINK = 5;

const hasLink = (s: string) => /https?:|www\.|\.(?:com|kr|net|io)\b|@/i.test(s);
const ID = /^[a-z]\d{1,4}$/;

export function cleanPairingNote(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, PARTNER_PAIRING_NOTE_MAX);
}

export type PartnerPairingKind = "brewery" | "restaurant";

export function partnerPairingProblem(input: { kind: PartnerPairingKind; drinkId?: unknown; drinkText?: unknown; foodText: unknown; note?: unknown; countForDrink: number; countTotal: number; editing?: boolean }): string | null {
  if (input.kind === "brewery" && !ID.test(String(input.drinkId ?? ""))) return "술을 골라 주세요.";
  const drinkText = String(input.drinkText ?? "").trim();
  if (input.kind === "restaurant" && drinkText.length < 1) return "술을 고르거나 이름을 적어 주세요.";
  if (drinkText.length > PARTNER_DRINK_TEXT_MAX) return `술 이름은 ${PARTNER_DRINK_TEXT_MAX}자까지예요.`;
  const food = String(input.foodText ?? "").trim();
  if (food.length < 1) return "어울리는 음식을 적어 주세요.";
  if (food.length > PARTNER_FOOD_TEXT_MAX) return `음식 이름은 ${PARTNER_FOOD_TEXT_MAX}자까지예요.`;
  const note = String(input.note ?? "").trim();
  if (note.length > PARTNER_PAIRING_NOTE_MAX) return `한 줄 이유는 ${PARTNER_PAIRING_NOTE_MAX}자까지예요.`;
  if (hasLink(note) || hasLink(food) || hasLink(drinkText)) return "링크나 이메일은 넣을 수 없어요.";
  if (!input.editing && input.countForDrink >= PARTNER_PAIRING_MAX_PER_DRINK) return `술 하나에 음식은 ${PARTNER_PAIRING_MAX_PER_DRINK}개까지예요.`;
  if (!input.editing && input.kind === "restaurant" && input.countTotal >= PARTNER_PAIRING_MAX_TOTAL) return `추천 페어링은 매장당 ${PARTNER_PAIRING_MAX_TOTAL}개까지예요.`;
  return null;
}

export type PairingSnapshot = { tier: string; es: number; reason: string };

/** 근거 줄 — 손님 화면 카드 아래 "“한 줄” — ○○"와 출처 "○○ 제공(양조장) / ○○ 추천(식당)". source가 매장마다 달라 독립 출처로 센다 */
export function partnerEvidence(name: string, note: string, kind: PartnerPairingKind = "brewery") {
  return { source: `${name} ${kind === "brewery" ? "제공" : "추천"}`, url: null as string | null, quote: note || null, who: name, tier: "official" as const };
}

/**
 * 기존 pairings 행(없으면 null)에 파트너 근거를 적용한 값.
 * 이미 official·sommelier면 등급·점수·이유를 그대로 두고 근거 줄만 보탠다. 그 외(맛 분석·블로그·매체·회원·없음)는 official로 올리고 점수는 max(기존, 90).
 */
export function applyPartnerPairing(existing: PairingSnapshot | null, note: string, name: string): PairingSnapshot {
  if (existing && (existing.tier === "official" || existing.tier === "sommelier")) return existing;
  const reason = note || `${josa(name, "이/가")} 직접 추천한 조합입니다.`;
  return { tier: "official", es: Math.max(existing?.es ?? 0, PARTNER_PAIRING_ES), reason };
}

/* ---------- 글자 → 카탈로그 연결 · 비슷한 음식(2026-09-29) ---------- */

export type FoodLite = { id: string; name: string; alias?: string[] | null; category?: string | null };
export type DrinkLite = { id: string; name: string };

/** 비교용 — 괄호 속(크기·용량) 떼고 소문자, 띄어쓰기·기호 제거 */
export const normFoodText = (s: unknown) => String(s ?? "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, "").replace(/[^가-힣a-z0-9]/g, "");

/**
 * 적은 음식 글자 → 카탈로그 음식. 틀린 연결이 공식 근거가 되지 않게 엄격하게:
 *  ① 이름·별칭과 똑같음(별칭은 2자 이상) ② 카탈로그 음식 이름(2자 이상)이 글자 안에 있으면 가장 긴 것("수제 육포" → 육포). 별칭 포함은 보지 않는다(넓은 별칭 "파전"이 "김치파전"을 해물파전으로 잘못 잇는다)
 */
export function resolveFoodText(text: unknown, foods: FoodLite[]): { id: string; name: string; how: "exact" | "contains" } | null {
  const t = normFoodText(text);
  if (!t) return null;
  const byName = foods.find((f) => normFoodText(f.name) === t);
  if (byName) return { id: byName.id, name: byName.name, how: "exact" };
  const byAlias = foods.find((f) => (f.alias ?? []).some((a) => { const k = normFoodText(a); return k.length >= 2 && k === t; }));
  if (byAlias) return { id: byAlias.id, name: byAlias.name, how: "exact" };
  let best: FoodLite | null = null;
  for (const f of foods) { const k = normFoodText(f.name); if (k.length >= 2 && t.includes(k) && (!best || k.length > normFoodText(best.name).length)) best = f; }
  return best ? { id: best.id, name: best.name, how: "contains" } : null;
}

/** 적은 술 글자 → 카탈로그 술 — 똑같거나, 카탈로그 이름(3자 이상)이 글자 안에 있으면 가장 긴 것("한산소곡주 700ml" → 한산소곡주) */
export function resolveDrinkText(text: unknown, drinks: DrinkLite[]): DrinkLite | null {
  const t = normFoodText(text);
  if (!t) return null;
  const exact = drinks.find((d) => normFoodText(d.name) === t);
  if (exact) return exact;
  let best: DrinkLite | null = null;
  for (const d of drinks) { const k = normFoodText(d.name); if (k.length >= 3 && t.includes(k) && (!best || k.length > normFoodText(best.name).length)) best = d; }
  return best;
}

/** 음식 글자의 분류 — 카탈로그에 연결되면 그 분류, 아니면 분류 낱말(구이·회·전·마른안주…)로 짐작 */
export function foodCategoryOf(text: unknown, foods: FoodLite[]): string | null {
  const r = resolveFoodText(text, foods);
  if (r) return foods.find((f) => f.id === r.id)?.category ?? null;
  const raw = String(text ?? "");
  for (const [re, c] of FOOD_CATEGORY_WORDS) if (re.test(raw)) return c;
  return null;
}

export type FoodMatch = "exact" | "text" | "similar";
export const FOOD_MATCH_LABEL: Record<FoodMatch, string> = { exact: "", text: "", similar: "비슷한 음식" };
export type FoodRef = { text: string; id?: string | null; category?: string | null };

/** 손님 검색·음식 화면에서 파트너 추천을 찾는 기준 — 같은 카탈로그 음식 > 글자가 서로 포함(2자 이상) > 같은 분류 */
export function foodSimilarity(q: FoodRef, e: FoodRef): FoodMatch | null {
  if (q.id && e.id && q.id === e.id) return "exact";
  const qt = normFoodText(q.text), et = normFoodText(e.text);
  if (qt.length >= 2 && et.length >= 2 && (qt.includes(et) || et.includes(qt))) return "text";
  if (q.category && e.category && q.category === e.category) return "similar";
  return null;
}
export const FOOD_MATCH_RANK: Record<FoodMatch, number> = { exact: 0, text: 1, similar: 2 };


/* ---------- 빠른 입력 추천(2026-10-03, docs/25 §2-1) ---------- */
/**
 * 파트너 페어링 화면의 "추천 조합 — 체크로 확정": 그 술의 카탈로그 조합(근거 있는 것 + 맛 분석 추정)에서 고른다.
 * 근거 등급 높은 것(양조장 공식 → 소믈리에 → 매체 → 블로그·회원 → AI → 맛 분석) → 맛 분석 점수 순. 이미 적은 음식은 뺀다.
 * 추천은 참고일 뿐 자동으로 넣지 않는다 — 사장님이 체크해야 "○○ 제공" 근거가 된다. 이유 기본값은 근거 있는 조합의 설명 첫 문장(120자)만, 맛 분석 추정은 빈칸(분석 문장은 참고 hint로만).
 */
export const SUGGEST_SRC_LABEL: Record<string, string> = { official: "양조장 공식", sommelier: "소믈리에", media: "매체 소개", blog: "블로그 후기", user: "회원 추천", ai: "AI 추정", profile: "맛 분석 추정" };
const SUGGEST_RANK: Record<string, number> = { official: 5, sommelier: 4, media: 3, blog: 2, user: 2, ai: 1, profile: 0 };
export type SuggestInput = { foodId: string; food: string; src?: string | null; s?: number | null; reason?: string | null };
/** note = 이유 칸 기본값(근거 있는 조합만 — 추정 조합은 사장님이 직접 적게 빈칸), hint = 참고로 보이는 분석·근거 문장 */
export type PairingSuggestion = { foodId: string; food: string; src: string; label: string; note: string; hint: string; s: number };
export const suggestionNote = (reason: unknown) => firstSentence(String(reason ?? ""), PARTNER_PAIRING_NOTE_MAX);
export function suggestPairings(rows: readonly SuggestInput[], exclude: ReadonlySet<string> = new Set(), n = PARTNER_SUGGEST_PER_DRINK): PairingSuggestion[] {
  const rank = (r: SuggestInput) => SUGGEST_RANK[r.src ?? "profile"] ?? 0;
  const sorted = [...rows].sort((a, b) => rank(b) - rank(a) || (b.s ?? 0) - (a.s ?? 0) || a.food.localeCompare(b.food, "ko"));
  const out: PairingSuggestion[] = [], seen = new Set<string>();
  for (const r of sorted) {
    if (!r.foodId || exclude.has(r.foodId) || seen.has(r.foodId)) continue;
    seen.add(r.foodId);
    const src = r.src && SUGGEST_SRC_LABEL[r.src] ? r.src : "profile";
    const hint = suggestionNote(r.reason);
    out.push({ foodId: r.foodId, food: r.food, src, label: SUGGEST_SRC_LABEL[src], note: src === "profile" || src === "ai" ? "" : hint, hint, s: r.s ?? 0 });
    if (out.length >= n) break;
  }
  return out;
}
