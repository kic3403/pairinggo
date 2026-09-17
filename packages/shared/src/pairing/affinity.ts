/**
 * 근거에서 배운 친화도(2026-09-17) — 맛 분석 점수(pf.s)의 새 계산식.
 *
 * 왜: 손으로 짠 맛 궁합 규칙(profileFit)이 실제 근거 조합 491건을 얼마나 골라내는지 재 보니 AUC 0.50(무작위)이었다.
 *   · 재는 법: 근거 조합(양성) vs 근거 조합의 술·음식을 서로 바꿔 짝지은 조합(음성 — 인기 술·인기 음식 편향이 빠진다), 술 기준 5겹 교차검증.
 *   · 맛 축 곱(단맛×매운맛 등 36개)을 회귀로 배워도 0.54. "술 종류 × 음식 분류"가 0.585, 여기에 "술 종류 × 매운 음식", "술 종류 × 기름진 음식"을 더하면 0.60.
 *   · 매끄럽게 하기(k)·근거 적은 종류 누르기(shrink)·음식 단위 보정을 바꿔 봐도 0.59~0.61로 같다 — 과신과 억울한 감점을 막는 쪽을 골랐다.
 * 그래서 점수는 근거 조합에서 센 세 가지 친화도(lift = 실제 횟수 ÷ 우연히 나올 횟수)의 로그 합으로 매긴다.
 *   ① 술 종류 × 음식(분류에서 출발해 그 음식 자체의 근거로 보정) ② 술 종류 × 매운 음식 ③ 술 종류 × 기름진 음식
 * ①의 보정: "과실주 × 한식"은 드물지만(0.6배) 그 8건 중 3건이 불고기다 — 분류만 보면 과실주 × 불고기가 억울하게 깎인다.
 *   음식 단위 lift = (그 음식과의 횟수 + k·분류 lift) ÷ (그 음식과 우연히 나올 횟수 + k). 그 음식의 근거가 없으면 분류 lift 그대로다.
 * profileFit의 plus/minus 문구는 카드의 설명으로 그대로 쓰고, 점수만 바꾼다. 근거가 늘면 다시 계산하면 저절로 좋아진다(`pf-recalc`).
 */
import type { FoodProfile } from "../types";
import { EVIDENCE_TIERS } from "./review-queue";

export const AFFINITY_SMOOTH = 4;
/** 근거가 적은 술 종류(브랜디 2건·청주 8건 등)는 친화도를 중립 쪽으로 누른다 — 가중치 = 그 종류의 근거 수 ÷ (근거 수 + AFFINITY_SHRINK) */
export const AFFINITY_SHRINK = 20;
/** 음식 성격을 가르는 기준 — 매운맛 3 이상, 기름기 4 이상 (2026-09-17 교차검증에서 고른 값) */
export const SPICY_FROM = 3, FATTY_FROM = 4;

type DrinkLike = { id: string; category: string };
type FoodLike = { id: string; name?: string; category: string; profile?: FoodProfile };
type PairLike = { d: string; f: string; src?: string | null };

export type AffinityAxis = "category" | "spice" | "fat";
type TableKey = AffinityAxis | "food";
const AXES: { key: TableKey; of: (d: DrinkLike, f: FoodLike) => [string, string] }[] = [
  { key: "category", of: (d, f) => [d.category, f.category] },
  { key: "spice", of: (d, f) => [d.category, (f.profile?.spice ?? 0) >= SPICY_FROM ? "매운 음식" : "맵지 않은 음식"] },
  { key: "fat", of: (d, f) => [d.category, (f.profile?.fat ?? 0) >= FATTY_FROM ? "기름진 음식" : "담백한 음식"] },
  { key: "food", of: (d, f) => [d.category, f.id] },
];

type Table = { pair: Map<string, number>; a: Map<string, number>; b: Map<string, number> };
export type AffinityModel = { n: number; tables: Record<TableKey, Table>; evidence: Set<string> };

const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** 근거 조합(official·sommelier·media·blog·user)만 세어 친화도 표를 만든다 */
export function buildAffinity(ds: { drinks: DrinkLike[]; foods: FoodLike[]; pairings: PairLike[] }): AffinityModel {
  const D = new Map(ds.drinks.map((d) => [d.id, d])), F = new Map(ds.foods.map((f) => [f.id, f]));
  const tables = Object.fromEntries(AXES.map((x) => [x.key, { pair: new Map(), a: new Map(), b: new Map() }])) as Record<TableKey, Table>;
  const evidence = new Set<string>();
  let n = 0;
  for (const p of ds.pairings) {
    if (!p.src || !(EVIDENCE_TIERS as readonly string[]).includes(p.src)) continue;
    const d = D.get(p.d), f = F.get(p.f);
    if (!d || !f || evidence.has(`${p.d}|${p.f}`)) continue;
    evidence.add(`${p.d}|${p.f}`); n++;
    for (const x of AXES) { const [a, b] = x.of(d, f); const t = tables[x.key]; inc(t.pair, `${a}|${b}`); inc(t.a, a); inc(t.b, b); }
  }
  return { n, tables, evidence };
}

export type AffinityFact = {
  axis: AffinityAxis; drinkSide: string; foodSide: string;
  /** 이 칸(술 종류 × 음식 성격)의 근거 횟수 · 우연히 나올 횟수 · 그 비(매끄럽게 한 값) */
  count: number; expected: number; cellLift: number;
  /** 점수에 쓰는 값 — category 축은 그 음식 자체의 근거로 보정한 값, 나머지는 cellLift와 같다 */
  lift: number;
  /** category 축만: 이 술 종류가 바로 그 음식과 짝지어진 근거 횟수 */
  foodCount?: number;
  /** 이 술 종류의 근거가 충분한 정도(0~1) */
  weight: number;
};

/** 한 조합의 친화도. 그 조합 자체가 근거 조합이면 자기 몫 1건을 빼고 센다(자기 근거로 자기 점수를 올리지 않게). */
export function affinityFacts(m: AffinityModel, d: DrinkLike, f: FoodLike): AffinityFact[] {
  const self = m.evidence.has(`${d.id}|${f.id}`) ? 1 : 0;
  const n = m.n - self;
  const cell = (key: TableKey) => {
    const [a, b] = AXES.find((x) => x.key === key)!.of(d, f); const t = m.tables[key];
    const count = Math.max(0, (t.pair.get(`${a}|${b}`) ?? 0) - self);
    const rowTotal = Math.max(0, (t.a.get(a) ?? 0) - self);
    const expected = n > 0 ? (rowTotal * Math.max(0, (t.b.get(b) ?? 0) - self)) / n : 0;
    return { a, b, count, expected, rowTotal };
  };
  return (["category", "spice", "fat"] as AffinityAxis[]).map((axis) => {
    const c = cell(axis);
    const cellLift = (c.count + AFFINITY_SMOOTH) / (c.expected + AFFINITY_SMOOTH);
    const weight = c.rowTotal / (c.rowTotal + AFFINITY_SHRINK);
    if (axis !== "category") return { axis, drinkSide: c.a, foodSide: c.b, count: c.count, expected: c.expected, cellLift, lift: cellLift, weight };
    const food = cell("food");
    const lift = (food.count + AFFINITY_SMOOTH * cellLift) / (food.expected + AFFINITY_SMOOTH);
    return { axis, drinkSide: c.a, foodSide: c.b, count: c.count, expected: c.expected, cellLift, lift, foodCount: food.count, weight };
  });
}

/** 원점수 = 세 친화도의 로그 합(근거가 적은 종류는 weight만큼 줄여서). 0이 중립, 양수면 근거 조합에서 평균보다 자주 짝지어진 성격 */
export function affinityRaw(m: AffinityModel, d: DrinkLike, f: FoodLike): number {
  return affinityFacts(m, d, f).reduce((s, x) => s + x.weight * Math.log(x.lift), 0);
}

/**
 * 원점수 → 0~100. 50이 중립이고 양끝으로 갈수록 완만해지는 곡선(로지스틱) — 백분위로 매기면 "평균보다 조금 드묾(0.6배)"이 0점이 된다.
 * 근거가 적어 잘 모르는 조합은 원점수가 0 근처라 50 근처에 머문다. 예) −0.9 → 21, −0.2 → 43, 0 → 50, 0.5 → 68, 0.9 → 79
 */
export const AFFINITY_CURVE = 1.5;
export function affinityScore(raw: number): number {
  return Math.round(100 / (1 + Math.exp(-AFFINITY_CURVE * raw)));
}

export const AFFINITY_STRONG = 1.3, AFFINITY_WEAK = 0.7, AFFINITY_MIN_COUNT = 6, AFFINITY_FOOD_MIN = 3;

/**
 * 카드 문구 — 뚜렷한 것만 한 줄씩. 횟수(드문 쪽은 기대 횟수)가 AFFINITY_MIN_COUNT 미만인 칸은 말하지 않는다(우연일 수 있다).
 * 그 음식 자체와의 근거가 AFFINITY_FOOD_MIN건 이상이면 그것을 먼저 말하고, 분류가 드물다는 주의는 붙이지 않는다.
 * plus: "근거 조합에서 과실주 × 불고기: 3번 짝지어짐" · "근거 조합에서 탁주 × 전: 평균의 2.1배 자주 짝지어짐(23건)"
 * minus: "근거 조합에서 탁주 × 회: 드물게 짝지어짐(평균의 0.4배)"
 */
export function affinityNotes(m: AffinityModel, d: DrinkLike, f: FoodLike): { plus: string[]; minus: string[] } {
  const plus: string[] = [], minus: string[] = [];
  for (const x of affinityFacts(m, d, f)) {
    const and = `${x.drinkSide} × ${x.foodSide}`;
    const foodBacked = x.axis === "category" && (x.foodCount ?? 0) >= AFFINITY_FOOD_MIN;
    if (foodBacked) plus.unshift(`근거 조합에서 ${x.drinkSide} × ${f.name ?? x.foodSide}: ${x.foodCount}번 짝지어짐`);
    else if (x.cellLift >= AFFINITY_STRONG && x.count >= AFFINITY_MIN_COUNT) plus.push(`근거 조합에서 ${and}: 평균의 ${x.cellLift.toFixed(1)}배 자주 짝지어짐(${x.count}건)`);
    else if (x.cellLift <= AFFINITY_WEAK && x.expected >= AFFINITY_MIN_COUNT) minus.push(`근거 조합에서 ${and}: 드물게 짝지어짐(평균의 ${x.cellLift.toFixed(1)}배)`);
  }
  return { plus: plus.slice(0, 1), minus: minus.slice(0, 1) };
}
