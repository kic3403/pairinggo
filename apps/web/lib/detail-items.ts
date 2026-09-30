/**
 * 술·음식 상세의 페어링 카드 목록 만들기(2026-09-30 속도 개선) — 상세 페이지와 '모두 보기' 페이지(/…/[slug]/all)가 같이 쓴다.
 * 상세는 앞쪽 CAP장만 싣는다: 해물파전처럼 171장을 다 실으면 페이지가 1.1MB(카드마다 HTML + 스트리밍 데이터 두 벌)라
 * 휴대폰에서 1초 넘게 받았다. 탭(전문가픽·대중픽·회원픽·맛 분석)마다 앞쪽 몇 장은 꼭 들어가게 하고, 나머지는 '모두 보기'로.
 */
import { D, F, SRC_LABEL, byDrink, byFood, explainOverall, pickOf, scorePairings, type Drink, type Food, type PickKey } from "@pairinggo/shared";
import { comboPlaces } from "./combo-places";
import { drinkHref, foodHref, type CardItem } from "@/app/(site)/_components/PairingCards";

export const DETAIL_CAP = 40;
const PER_PICK = 8;

/** 앞쪽 CAP장 + 묶음마다 앞쪽 PER_PICK장(순위는 원래대로) */
export function capItems(items: CardItem[], cap = DETAIL_CAP): { items: CardItem[]; hidden: number } {
  if (items.length <= cap) return { items, hidden: 0 };
  const keep = new Set<number>();
  items.slice(0, cap).forEach((_, i) => keep.add(i));
  const seen: Partial<Record<PickKey, number>> = {};
  items.forEach((it, i) => { const k = pickOf(it.pairing.src); const n = seen[k] ?? 0; if (n < PER_PICK) { seen[k] = n + 1; keep.add(i); } });
  const picked = items.filter((_, i) => keep.has(i));
  return { items: picked, hidden: items.length - picked.length };
}

export async function foodItems(food: Food): Promise<CardItem[]> {
  const rows = byFood[food.id] || [];
  const scored = scorePairings(rows, (p) => D[p.d]?.category || "");
  const combos = await comboPlaces();
  return scored.map((s) => {
    const drink = D[s.p.d];
    const sub = [drink?.category, drink?.abv != null ? `${drink.abv}%` : null, drink?.region].filter(Boolean).join(" · ");
    return { href: drinkHref(drink?.name || s.p.d), name: drink?.name || s.p.d, sub, grade: s.grade, explain: explainOverall(s, SRC_LABEL[s.p.src ?? "profile"]), pairing: s.p, places: combos.get(`${s.p.d}|${s.p.f}`) };
  });
}

export async function drinkItems(drink: Drink): Promise<CardItem[]> {
  const rows = byDrink[drink.id] || [];
  const scored = scorePairings(rows, (p) => F[p.f]?.category || "");
  const combos = await comboPlaces();
  return scored.map((s) => {
    const food = F[s.p.f];
    // 음식 화면으로 넘어갈 때 이 술을 들고 간다(?d=) — 맛집 목록이 이 술과 그 음식을 함께 파는 식당을 먼저 보여 준다
    return { href: `${foodHref(food?.name || s.p.f)}?d=${drink.id}`, name: food?.name || s.p.f, sub: food?.tags?.slice(0, 3).join(" · "), grade: s.grade, explain: explainOverall(s, SRC_LABEL[s.p.src ?? "profile"]), pairing: s.p, places: combos.get(`${s.p.d}|${s.p.f}`) };
  });
}
