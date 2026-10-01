/**
 * 술·음식 상세의 SNS 재료(2026-10-02) — "이 술엔 이 음식 3가지" 그림 카드(`/drinks/[slug]/card.png`·`/foods/[slug]/card.png`)와 붙여 넣을 글.
 * 순서는 상세 화면·링크 미리보기 그림과 같은 규칙(shared scorePairings), 줄마다 등급과 근거 표시를 붙여 추정 조합이 확인된 추천처럼 보이지 않게 한다.
 * 글 규칙은 shared seo/share-card.ts detailCaption.
 */
import { D, F, byDrink, byFood, confidenceText, kindOf, scorePairings, subtypeLabel, toSlug, type DetailShareItem, type Drink, type Food } from "@pairinggo/shared";

export type DetailShare = { name: string; meta: string; items: DetailShareItem[]; total: number; path: string };

export function drinkShare(drink: Drink, n = 3): DetailShare {
  const rows = byDrink[drink.id] || [];
  const items = scorePairings(rows, (p) => F[p.f]?.category || "").map((s) => ({ name: F[s.p.f]?.name ?? "", grade: s.grade.label, conf: confidenceText(s.p) })).filter((x) => x.name).slice(0, n);
  return { name: drink.name, meta: [kindOf(drink) === "trad" ? drink.category : subtypeLabel(drink), drink.abv != null ? `${drink.abv}%` : null, drink.brewery].filter(Boolean).join(" · "), items, total: rows.length, path: `/drinks/${toSlug(drink.name)}` };
}

export function foodShare(food: Food, n = 3): DetailShare {
  const rows = byFood[food.id] || [];
  const items = scorePairings(rows, (p) => D[p.d]?.category || "").map((s) => ({ name: D[s.p.d]?.name ?? "", grade: s.grade.label, conf: confidenceText(s.p) })).filter((x) => x.name).slice(0, n);
  return { name: food.name, meta: [food.category, ...(food.tags ?? []).slice(0, 2)].join(" · "), items, total: rows.length, path: `/foods/${toSlug(food.name)}` };
}
