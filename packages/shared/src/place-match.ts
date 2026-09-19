/**
 * 고른 조합을 파는 식당 먼저(2026-09-19 사용자 요청) — 술을 검색해 음식을 골랐다면, 그 술과 같은(또는 비슷한) 음식을 함께 파는 식당을
 * 맛집 목록 맨 앞에 둔다. 무엇을 파는지는 운영자·파트너가 확인한 정보(place_info: 취급 술·메뉴·메뉴판·콜키지)로만 판단한다 — 카카오·구글은 메뉴를 주지 않는다.
 *
 * 순위(score, 높을수록 앞) — 술을 고른 경우
 *   90 그 술 + 같은 음식 ("딱 맞는 곳")
 *   80 그 술 + 비슷한 음식
 *   70 같은 음식 + 콜키지 가능 — 고른 술을 가져가서 그 조합 그대로 먹을 수 있다(2026-09-19 사용자 요청)
 *   60 그 술만
 *   50 비슷한 음식 + 콜키지 가능
 *   40 같은 종류 술 + 같은 음식 · 30 같은 종류 술 + 비슷한 음식 · 25 같은 종류 술만
 *   20 같은 음식만 · 10 비슷한 음식만
 * 술을 고르지 않았으면 20·10만(콜키지는 가져갈 술이 있을 때만 의미가 있다).
 * 같은 순위 안에서는 콜키지가 싼 곳부터(무료 → 싼 값 → 값 모름 → 콜키지 정보 없음), 그다음은 원래 순서(평점·예약 가능·확인 정보).
 *   술: 그 술(카탈로그 id·이름이 같음) · 같은 종류(약주면 약주, 탁주면 막걸리)
 *   음식: 그 음식(카탈로그 id·이름) · 비슷한 음식(similarFoods, 음식 별칭 — "파전"·"부침개"처럼 넓은 말이라 같은 음식으로는 안 친다)
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
  /** 콜키지(술 가져가기) — 가능할 때만. fee: 병당 원(0 = 무료), 모르면 null */
  corkage: { fee: number | null } | null;
  /** 카드에 보일 한 줄 — "한산소곡주 · 해물파전 함께 팔아요" */
  label: string;
};

/** 이름 비교용 — 괄호 속(크기·용량)·띄어쓰기·기호 떼기 */
export const normMenu = (s: string) => String(s ?? "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, "").replace(/[\s·.,'"\-_/]/g, "");

/**
 * 콜키지 메모에서 병당 값 — "병당 1만원" 10000 · "15,000원" 15000 · "5천원" 5000 · "무료" 0 · "전통주 무료"(전통주를 가져갈 때) 0.
 * 값이 여러 개면 가장 싼 것. 값도 무료도 없으면 null.
 */
export function corkageFee(note: string | null | undefined, traditional = true): number | null {
  const s = String(note ?? "").replace(/\s+/g, " ");
  if (!s.trim()) return null;
  if (traditional && /전통주[^,.;/]*?(무료|free|프리|0원)/i.test(s)) return 0;
  const fees: number[] = [];
  // 읽은 부분은 지우고 다음 모양을 찾는다("1만5천원"의 "5천원"을 따로 세지 않게)
  const MAN = /(\d+(?:\.\d+)?)\s*만\s*(?:(\d)\s*천)?\s*원?/g, CHEON = /(\d+)\s*천\s*원/g, WON = /(\d{1,3}(?:,\d{3})+|\d{4,6})\s*원/g;
  for (const m of s.matchAll(MAN)) fees.push(Math.round(Number(m[1]) * 10000 + (m[2] ? Number(m[2]) * 1000 : 0)));
  const s2 = s.replace(MAN, " ");
  for (const m of s2.matchAll(CHEON)) fees.push(Number(m[1]) * 1000);
  for (const m of s2.replace(CHEON, " ").matchAll(WON)) fees.push(Number(m[1].replace(/,/g, "")));
  const ok = fees.filter((n) => Number.isFinite(n) && n >= 0 && n <= 1_000_000);
  if (ok.length) return Math.min(...ok);
  return /(무료|free|프리|없음|안\s*받)/i.test(s) ? 0 : null;
}

/** 콜키지 값 화면 표시 — 0 "콜키지 무료", 10000 "콜키지 1만원", 15000 "콜키지 1.5만원", 5000 "콜키지 5천원", 모름 "콜키지 가능" */
export function corkageLabel(fee: number | null): string {
  if (fee == null) return "콜키지 가능";
  if (fee === 0) return "콜키지 무료";
  if (fee >= 10000) return `콜키지 ${Number((fee / 10000).toFixed(1))}만원`;
  return fee % 1000 === 0 ? `콜키지 ${fee / 1000}천원` : `콜키지 ${fee.toLocaleString("ko-KR")}원`;
}

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

/** 순위표 — [술, 음식, 콜키지 가져가기] → score */
function rank(drink: PlaceMatch["drink"], food: PlaceMatch["food"], byo: boolean, hasDrinkTarget: boolean): number {
  if (drink === "exact") return food === "exact" ? 90 : food === "similar" ? 80 : 60;
  if (hasDrinkTarget && byo && food === "exact") return 70;
  if (hasDrinkTarget && byo && food === "similar") return 50;
  if (drink === "kind") return food === "exact" ? 40 : food === "similar" ? 30 : 25;
  return food === "exact" ? 20 : food === "similar" ? 10 : 0;
}

export function placeMatch(info: PlaceInfo | null | undefined, t: PlaceMatchTarget): PlaceMatch {
  const none: PlaceMatch = { score: 0, drink: null, drinkName: null, food: null, foodName: null, corkage: null, label: "" };
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

  // 콜키지 — 가능이라고 확인된 곳만
  const corkage = info.corkage === "yes" ? { fee: corkageFee(info.corkageNote) } : null;
  const byo = !!corkage && drink !== "exact";
  const score = rank(drink, food, byo, !!t.drink);
  if (!score) return none;

  const parts: string[] = [];
  if (drink === "exact" && food === "exact") parts.push(`${drinkName} · ${foodName} 함께 팔아요`);
  else {
    if (drink === "exact") parts.push(`${drinkName} 있어요`);
    if (drink === "kind") parts.push(`같은 종류 술 ${drinkName}`);
    if (food === "exact") parts.push(`${foodName} 메뉴`);
    if (food === "similar") parts.push(`비슷한 메뉴 ${foodName}`);
    if (t.drink && byo && food) parts.push(`${corkageLabel(corkage!.fee)} — ${t.drink.name} 가져가기`);
  }
  return { score, drink, drinkName, food, foodName, corkage, label: parts.join(" · ") };
}

/** 같은 순위 안 콜키지 순서 — 무료 0 → 싼 값 → 값 모름 → 콜키지 없음 */
const feeKey = (m?: PlaceMatch | null) => (m?.corkage ? m.corkage.fee ?? 900_000 : 1_000_000);

/** 조합이 맞는 식당을 순위 높은 순으로 맨 앞에 — 같은 순위는 콜키지가 싼 곳부터, 그다음은 원래 순서(평점·예약 가능·확인 정보 순) 그대로 */
export function matchFirst<T extends { match?: PlaceMatch | null }>(places: T[]): T[] {
  return places.map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.match?.score ?? 0) - (a.p.match?.score ?? 0) || ((a.p.match?.score ?? 0) ? feeKey(a.p.match) - feeKey(b.p.match) : 0) || a.i - b.i)
    .map((x) => x.p);
}
