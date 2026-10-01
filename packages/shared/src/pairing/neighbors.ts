/**
 * 근거 없는 술의 이웃(2026-10-01) — 이 술엔 아직 양조장·소믈리에·매체가 확인한 조합이 없을 때,
 * 같은 양조장 술·비슷한 술 가운데 근거가 있는 것을 골라 그 술의 확인된 음식과 함께 보여 준다.
 * 이 술의 등급·점수에는 넣지 않는다(다른 술의 근거라서) — 화면에 "같은 양조장 ○○는 이 음식과 확인됐어요"로만.
 */
import type { Drink, Food, Pairing } from "../types";
import { CONFIDENCE_RANK, confidenceOf, strengthOf, type Confidence } from "./confidence";

export type NeighborRel = "brewery" | "similar";
export type EvidenceNeighbor = { drink: Drink; rel: NeighborRel; why: string[]; foods: { food: Food; conf: Exclude<Confidence, "estimate"> }[] };

/**
 * candidates는 보여 줄 차례대로(같은 양조장 먼저). 근거(확인·약함) 조합이 하나도 없는 술은 뺀다.
 * 술마다 음식은 근거 확인 → 근거 강도 순으로 perDrink개.
 */
export function evidenceNeighbors(
  candidates: { drink: Drink; rel: NeighborRel; why?: string[] }[],
  pairingsOf: (drinkId: string) => readonly Pairing[] | undefined,
  foodOf: (foodId: string) => Food | undefined,
  n = 4, perDrink = 2,
): EvidenceNeighbor[] {
  const out: EvidenceNeighbor[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (out.length >= n) break;
    if (seen.has(c.drink.id)) continue;
    seen.add(c.drink.id);
    const foods = (pairingsOf(c.drink.id) ?? [])
      .map((p) => ({ p, conf: confidenceOf(p), e: strengthOf(p).e }))
      .filter((x): x is typeof x & { conf: Exclude<Confidence, "estimate"> } => x.conf !== "estimate")
      .sort((a, b) => CONFIDENCE_RANK[b.conf] - CONFIDENCE_RANK[a.conf] || b.e - a.e)
      .map((x) => ({ food: foodOf(x.p.f), conf: x.conf }))
      .filter((x): x is { food: Food; conf: Exclude<Confidence, "estimate"> } => !!x.food)
      .slice(0, perDrink);
    if (foods.length) out.push({ drink: c.drink, rel: c.rel, why: c.why ?? [], foods });
  }
  return out;
}

export type FoodEvidenceNeighbor = { food: Food; why: string[]; drinks: { drink: Drink; conf: Exclude<Confidence, "estimate"> }[] };

/**
 * 음식 쪽 짝(2026-10-01) — 근거 없는 음식에 "비슷한 음식은 이런 술과 확인됐어요".
 * candidates는 보여 줄 차례대로(shared similarFoods). 음식마다 술은 근거 확인 → 근거 강도 순으로 perFood개.
 */
export function foodEvidenceNeighbors(
  candidates: { food: Food; why?: string[] }[],
  pairingsOf: (foodId: string) => readonly Pairing[] | undefined,
  drinkOf: (drinkId: string) => Drink | undefined,
  n = 4, perFood = 2,
): FoodEvidenceNeighbor[] {
  const out: FoodEvidenceNeighbor[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (out.length >= n) break;
    if (seen.has(c.food.id)) continue;
    seen.add(c.food.id);
    const drinks = (pairingsOf(c.food.id) ?? [])
      .map((p) => ({ p, conf: confidenceOf(p), e: strengthOf(p).e }))
      .filter((x): x is typeof x & { conf: Exclude<Confidence, "estimate"> } => x.conf !== "estimate")
      .sort((a, b) => CONFIDENCE_RANK[b.conf] - CONFIDENCE_RANK[a.conf] || b.e - a.e)
      .map((x) => ({ drink: drinkOf(x.p.d), conf: x.conf }))
      .filter((x): x is { drink: Drink; conf: Exclude<Confidence, "estimate"> } => !!x.drink)
      .slice(0, perFood);
    if (drinks.length) out.push({ food: c.food, why: c.why ?? [], drinks });
  }
  return out;
}
