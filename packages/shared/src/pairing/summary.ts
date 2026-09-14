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

export type CardSummary = { points: string[]; cautions: string[] };

export function cardSummary(p: Pick<Pairing, "pf" | "reason">): CardSummary {
  return { points: (p.pf?.plus ?? []).map(tidyPoint), cautions: (p.pf?.minus ?? []).map(tidyPoint) };
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
