/**
 * 연관 추천 — 비슷한 술 / 비슷한 음식.
 * Phase 1-e: 술은 맛 프로필(5축) 유클리드 거리를 반영한다.
 */
import { DATA, tscore } from "./data";
import type { Drink, DrinkProfile, Food } from "./types";

export type Similar<T> = { x: T; s: number; why: string[] };

const PROFILE_KEYS: (keyof DrinkProfile)[] = ["sweet", "acid", "body", "fizz", "aroma"];
/** 5축 유클리드 거리 (0 ~ 약 8.9). 프로필이 없으면 null */
export function profileDistance(a?: DrinkProfile, b?: DrinkProfile): number | null {
  if (!a || !b) return null;
  let s = 0;
  for (const k of PROFILE_KEYS) s += (a[k] - b[k]) ** 2;
  return Math.sqrt(s);
}

/**
 * 종류 +3 · 같은 도/광역시 +2 · 도수 차 ≤3 +1 · 공통 맛 태그 +1(최대 2) · 수상 +0.3
 * · 맛 프로필: 거리 ≤ 2.0 이면 +2 ("맛 프로필 비슷"), ≤ 3.0 이면 +1, 그 이상은 −(거리−3)×0.8
 */
export function similarDrinks(d: Drink, n = 5): Similar<Drink>[] {
  const rp = (d.region || "").split(" ")[0];
  return DATA.drinks.filter((x) => x.id !== d.id).map((x) => {
    let s = 0; const why: string[] = [];
    if (x.category === d.category) { s += 3; why.push(x.category); }
    const xp = (x.region || "").split(" ")[0]; if (rp && xp === rp) { s += 2; why.push(rp); }
    if (d.abv != null && x.abv != null && Math.abs(d.abv - x.abv) <= 3) { s += 1; why.push("도수 비슷"); }
    const shared = (x.flavor || []).filter((t) => (d.flavor || []).includes(t));
    if (shared.length) { s += Math.min(2, shared.length); why.push(...shared.slice(0, 2)); }
    if (x.awards?.length) s += 0.3;
    const dist = profileDistance(d.profile, x.profile);
    if (dist != null) {
      if (dist <= 2.0) { s += 2; why.push("맛 프로필 비슷"); }
      else if (dist <= 3.0) s += 1;
      else s -= (dist - 3) * 0.8;
    }
    return { x, s, why };
  }).filter((o) => o.s >= 3).sort((a, b) => b.s - a.s || tscore(b.x) - tscore(a.x)).slice(0, n);
}

/** 같은 분류 +3 · 공통 태그 +1씩 */
export function similarFoods(f: Food, n = 4): Similar<Food>[] {
  return DATA.foods.filter((x) => x.id !== f.id).map((x) => {
    let s = 0; const why: string[] = [];
    if (x.category === f.category) { s += 3; why.push(x.category); }
    const shared = (x.tags || []).filter((t) => (f.tags || []).includes(t));
    if (shared.length) { s += shared.length; why.push(...shared.slice(0, 2)); }
    return { x, s, why };
  }).filter((o) => o.s >= 2).sort((a, b) => b.s - a.s || tscore(b.x) - tscore(a.x)).slice(0, n);
}
