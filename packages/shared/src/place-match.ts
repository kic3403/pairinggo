/**
 * 고른 조합을 파는 식당 먼저(2026-09-19 사용자 요청) — 술을 검색해 음식을 골랐다면, 그 술과 같은(또는 비슷한) 음식을 함께 파는 식당을
 * 맛집 목록 맨 앞에 둔다. 무엇을 파는지는 운영자·파트너가 확인한 정보(place_info: 취급 술·메뉴·메뉴판)로만 판단한다 — 카카오·구글은 메뉴를 주지 않는다.
 *
 * 점수 = 술 점수 × 3 + 음식 점수 (0~8) — 술이 먼저다(사용자가 고른 건 술).
 *   술: 그 술(카탈로그 id·이름이 같음) 2 · 같은 종류의 술(약주면 약주, 탁주면 막걸리) 1
 *   음식: 그 음식(카탈로그 id·이름) 2 · 비슷한 음식(similarFoods, 음식 별칭 — "파전"·"부침개"처럼 넓은 말이라 같은 음식으로는 안 친다) 1
 *   → 술+음식 그대로 8 · 술+비슷한 음식 7 · 술만 6 · 같은 종류 술+음식 5 … 음식만 2 · 비슷한 음식만 1
 * 술을 고르지 않았으면 음식 점수만(0~2).
 */
import type { PlaceInfo } from "./place-info";

/** 술은 이름으로만(카탈로그 drinks.alias는 양조장 이름 같은 문자열이라 쓰지 않는다) */
export type MatchDrink = { id: string; name: string; category: string };
export type MatchFood = { id: string; name: string; alias?: string[] };
export type PlaceMatchTarget = {
  drink?: MatchDrink | null;
  food: MatchFood;
  /** 비슷한 음식(카탈로그) — similarFoods 결과와 같은 분류 음식 */
  similarFoods: MatchFood[];
  /** 카탈로그 술 id → 이름·종류(매장이 고른 카탈로그 술의 종류를 알려고) */
  drinkCatalog: Map<string, { name: string; category: string }>;
};
export type PlaceMatch = {
  score: number;
  drink: "exact" | "kind" | null; drinkName: string | null;
  food: "exact" | "similar" | null; foodName: string | null;
  /** 카드에 보일 한 줄 — "한산소곡주 · 해물파전 함께 팔아요" */
  label: string;
};

/** 이름 비교용 — 괄호 속(크기·용량)·띄어쓰기·기호 떼기 */
export const normMenu = (s: string) => String(s ?? "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, "").replace(/[\s·.,'"\-_/]/g, "");

/** 술 종류 → 메뉴판에 흔히 적히는 말(카탈로그에 없는 술 이름으로 종류를 짐작할 때) */
const KIND_WORDS: Record<string, string[]> = {
  탁주: ["막걸리", "탁주", "동동주"], 약주: ["약주"], 청주: ["청주", "정종"], 증류주: ["소주", "증류", "고량"],
  과실주: ["와인", "과실주", "사과주", "복분자"], 허니와인: ["허니와인", "벌꿀주", "미드"], 리큐르: ["리큐르"], 브랜디: ["브랜디"],
};

/** 메뉴 이름에 목표 이름이 들어 있나 — "해물파전(대)"는 "해물파전", "한산소곡주 700ml"은 "한산소곡주". 두 글자 미만은 비교하지 않는다 */
function hasName(menu: string, names: string[]): boolean {
  const m = normMenu(menu);
  if (m.length < 2) return false;
  return names.some((n) => { const t = normMenu(n); return t.length >= 2 && (m === t || m.includes(t)); });
}

export function placeMatch(info: PlaceInfo | null | undefined, t: PlaceMatchTarget): PlaceMatch {
  const none: PlaceMatch = { score: 0, drink: null, drinkName: null, food: null, foodName: null, label: "" };
  if (!info) return none;
  const drinkTexts = [...(info.drinkNames ?? []), ...(info.drinkItems ?? []).map((d) => d.name)];
  const menuTexts = [...(info.menuNames ?? []), ...(info.menuItems ?? []).map((m) => m.name)];

  // 술
  let drink: PlaceMatch["drink"] = null, drinkName: string | null = null;
  if (t.drink) {
    if (info.drinks?.includes(t.drink.id) || drinkTexts.some((x) => hasName(x, [t.drink!.name]))) {
      drink = "exact"; drinkName = t.drink.name;
    } else {
      const sameKind = (info.drinks ?? []).map((id) => t.drinkCatalog.get(id)).find((d) => d && d.category === t.drink!.category);
      const words = KIND_WORDS[t.drink.category] ?? [t.drink.category];
      const kindText = sameKind ? null : drinkTexts.find((x) => words.some((w) => normMenu(x).includes(normMenu(w))));
      if (sameKind || kindText) { drink = "kind"; drinkName = sameKind?.name ?? kindText ?? null; }
    }
  }

  // 음식
  let food: PlaceMatch["food"] = null, foodName: string | null = null;
  const shown = (x: string) => x.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
  if ((t.food.id && info.foods?.includes(t.food.id)) || menuTexts.some((x) => hasName(x, [t.food.name]))) { food = "exact"; foodName = t.food.name; }
  else {
    const simIds = new Set(t.similarFoods.map((s) => s.id));
    const byId = (info.foods ?? []).find((id) => simIds.has(id));
    const simWords = [...t.similarFoods.map((s) => s.name), ...(t.food.alias ?? [])];
    const byText = byId ? undefined : menuTexts.find((x) => hasName(x, simWords));
    if (byId || byText) { food = "similar"; foodName = byId ? t.similarFoods.find((s) => s.id === byId)?.name ?? null : shown(byText!); }
  }

  const dp = drink === "exact" ? 2 : drink === "kind" ? 1 : 0, fp = food === "exact" ? 2 : food === "similar" ? 1 : 0;
  const score = dp * 3 + fp;
  if (!score) return none;
  const parts: string[] = [];
  if (drink === "exact" && food === "exact") parts.push(`${drinkName} · ${foodName} 함께 팔아요`);
  else {
    if (drink === "exact") parts.push(`${drinkName} 있어요`);
    if (drink === "kind") parts.push(`같은 종류 술 ${drinkName}`);
    if (food === "exact") parts.push(`${foodName} 메뉴`);
    if (food === "similar") parts.push(`비슷한 메뉴 ${foodName}`);
  }
  return { score, drink, drinkName, food, foodName, label: parts.join(" · ") };
}

/** 조합이 맞는 식당을 점수 높은 순으로 맨 앞에 — 점수가 같거나 0인 곳은 원래 순서(평점·예약 가능·확인 정보 순) 그대로 */
export function matchFirst<T extends { match?: PlaceMatch | null }>(places: T[]): T[] {
  return places.map((p, i) => ({ p, i })).sort((a, b) => (b.p.match?.score ?? 0) - (a.p.match?.score ?? 0) || a.i - b.i).map((x) => x.p);
}
