/**
 * 페어링 카드의 라벨 줄 — 문장 대신 "페어링 포인트 · 주의 · 맛 프로필"로 짧게(2026-09-14 사용자 요청).
 * 포인트·주의는 맛 궁합(profileFit)의 plus/minus를 다듬은 것, 맛 프로필은 카드 상대(술 또는 음식)의 5~6축 점수.
 * 출처가 있는 긴 설명(reason)은 카드에서 접어 두고 "자세히"로 본다.
 */
import type { DrinkProfile, FoodProfile, Pairing } from "../types";

/** 숫자 끝자리의 받침 유무(일·삼·육·칠·팔·영은 받침) — 조사 선택용 */
const digitBatchim = (n: string) => "013678".includes(n[n.length - 1]);
const josaGa = (n: string) => (digitBatchim(n) ? "이" : "가");
const josaEul = (n: string) => (digitBatchim(n) ? "을" : "를");
const josaGwa = (n: string) => (digitBatchim(n) ? "과" : "와");

/** "바디 3점 ↔ 무게 2점 균형" → "바디 3과 무게 2가 균형", "단맛 4점이 매운맛 3점을 감싸줌" → "단맛 4가 매운맛 3을 감싸줌" */
export function tidyPoint(s: string): string {
  const m = /^(.+?) (\d+)점 ↔ (.+?) (\d+)점 균형$/.exec(s);
  if (m) return `${m[1]} ${m[2]}${josaGwa(m[2])} ${m[3]} ${m[4]}${josaGa(m[4])} 균형`;
  return s
    .replace(/(\d+(?:\.\d+)?)점이/g, (_, n) => `${n}${josaGa(n)}`)
    .replace(/(\d+(?:\.\d+)?)점을/g, (_, n) => `${n}${josaEul(n)}`)
    .replace(/(\d+(?:\.\d+)?)점과/g, (_, n) => `${n}${josaGwa(n)}`)
    .replace(/(\d+(?:\.\d+)?)점/g, "$1");
}

/**
 * 문장형 포인트 → 짧은 라벨(2026-09-26 사용자 요청: 문장 대신 심플하고 직관적으로). 생성 규칙(lineup.ts·affinity.ts)의 문형 19가지를 2~6자로 줄인다.
 * 모르는 문형은 숫자·조사를 걷어낸 뒤 12자에서 자른다. 원문은 툴팁으로 남긴다.
 */
const SHORT: [RegExp, string][] = [
  [/^바디 \d+점 ↔ 무게 \d+점 균형$/, "무게 균형"],
  [/^근거 조합에서 .+: 평균의 [\d.]+배 자주 짝지어짐/, "자주 짝지음"],
  [/^근거 조합에서 .+: \d+번 짝지어짐$/, "단골 조합"],
  [/^근거 조합에서 .+: 드물게 짝지어짐/, "드문 조합"],
  [/^적당한 단맛·바디가 감칠맛을 받쳐줌$/, "감칠맛 살림"],
  [/^산미 \d+·탄산 \d+점이 기름기 \d+점을 씻어냄$/, "기름기 씻김"],
  [/^도수 [\d.]+%가 진한 기름기·무게를 정리$/, "기름기 정리"],
  [/^술 단맛 \d+점이 달콤한 양념과 어울림$/, "단 양념 궁합"],
  [/^술 단맛 \d+점이 디저트 단맛과 어울림$/, "디저트 궁합"],
  [/^단맛 \d+점이 매운맛 \d+점을 감싸줌$/, "매운맛 감쌈"],
  [/^짠맛을 단맛·산미가 중화$/, "짠맛 중화"],
  [/^절제된 향이 재료 맛을 살림$/, "재료 맛 살림"],
  [/^바디 \d+점과 음식 무게 \d+점 차이가 큼$/, "무게 차이 큼"],
  [/^높은 도수가 가벼운 음식을 압도$/, "도수가 셈"],
  [/^드라이한 술이 단 양념 옆에서 밋밋해짐$/, "단 양념에 밋밋"],
  [/^강한 향·바디가 섬세한 맛을 가림$/, "향이 맛을 가림"],
  [/^단 술이 담백한 맛과 겉돎$/, "담백함과 겉돎"],
  [/^드라이한 술이 디저트 옆에서 시고 쓰게 느껴짐$/, "디저트에 씀"],
  [/^드라이한 술이 매운맛을 더 날카롭게 함$/, "매운맛 날카로움"],
];
export function shortPoint(s: string): string {
  for (const [re, label] of SHORT) if (re.test(s)) return label;
  const t = tidyPoint(s).replace(/\d+(\.\d+)?%?/g, "").replace(/\s+/g, " ").replace(/[·:]/g, " ").trim();
  return t.length > 12 ? `${t.slice(0, 12)}…` : t;
}

export type CardPoint = { label: string; full: string };
export type CardSummary = { points: CardPoint[]; cautions: CardPoint[] };

/** 카드 라벨 — label은 짧은 말, full은 원문(툴팁). 같은 라벨은 하나로 */
export function cardSummary(p: Pick<Pairing, "pf" | "reason">): CardSummary {
  const mk = (arr: string[]) => { const seen = new Set<string>(); return arr.map((s) => ({ label: shortPoint(s), full: tidyPoint(s) })).filter((x) => x.label && !seen.has(x.label) && seen.add(x.label)); };
  return { points: mk(p.pf?.plus ?? []), cautions: mk(p.pf?.minus ?? []) };
}

const DRINK_AXES: [keyof DrinkProfile, string][] = [["body", "바디"], ["acid", "산미"], ["sweet", "단맛"], ["fizz", "탄산"], ["aroma", "향"]];
const FOOD_AXES: [keyof FoodProfile, string][] = [["weight", "무게"], ["fat", "기름기"], ["spice", "매운맛"], ["umami", "감칠맛"], ["salt", "짠맛"], ["sweet", "단맛"]];

/** 맛 프로필 축 목록 — 상세 화면 막대(데일리샷 Tasting Notes 자리)와 카드 한 줄이 같은 순서·이름을 쓴다. 값은 1~5 */
export function profileAxes(kind: "drink" | "food", p: DrinkProfile | FoodProfile | undefined): { key: string; label: string; value: number }[] {
  if (!p) return [];
  const axes = (kind === "drink" ? DRINK_AXES : FOOD_AXES) as [string, string][];
  return axes.map(([key, label]) => ({ key, label, value: Math.max(0, Math.min(5, Number((p as Record<string, number>)[key]) || 0)) }));
}

/** 맛 프로필 한 줄 — "바디 3 · 산미 2 · …". 프로필이 없으면 null */
export function profileLine(kind: "drink", p: DrinkProfile | undefined): string | null;
export function profileLine(kind: "food", p: FoodProfile | undefined): string | null;
export function profileLine(kind: "drink" | "food", p: DrinkProfile | FoodProfile | undefined): string | null {
  if (!p) return null;
  const axes = (kind === "drink" ? DRINK_AXES : FOOD_AXES) as [string, string][];
  return axes.map(([k, label]) => `${label} ${(p as Record<string, number>)[k]}`).join(" · ");
}
