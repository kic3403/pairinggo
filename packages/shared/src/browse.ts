/**
 * 둘러보기 목록 — /browse/:kind/:key (종류 · 지역 · 양조장 · 음식 분류) 필터·정렬 로직.
 */
import { DATA, tscore } from "./data";
import type { Drink, Food } from "./types";
import type { BrowseKind } from "./search/docs";

export type BrowseSort = "popular" | "abv-asc" | "abv-desc" | "award" | "name";
export const SORT_LABEL: Record<BrowseSort, string> = { popular: "인기순", award: "수상순", "abv-asc": "도수 낮은순", "abv-desc": "도수 높은순", name: "이름순" };

export type AbvBand = "low" | "mid" | "high";
export const ABV_BANDS: { key: AbvBand; label: string; test: (abv: number | null) => boolean }[] = [
  { key: "low", label: "~9%", test: (a) => a != null && a <= 9 },
  { key: "mid", label: "10~19%", test: (a) => a != null && a >= 10 && a <= 19 },
  { key: "high", label: "20%~", test: (a) => a != null && a >= 20 },
];

export type BrowseParams = { kind: BrowseKind | "food-category"; key: string; sort?: BrowseSort; abv?: AbvBand | null; tag?: string | null };
export type BrowseResult = { title: string; sub: string; drinks: Drink[]; foods: Food[]; tags: { tag: string; count: number }[]; total: number };

const byPopular = (a: Drink, b: Drink) => tscore(b) - tscore(a) || (b.awards?.length || 0) - (a.awards?.length || 0);

export function browseList(p: BrowseParams): BrowseResult {
  const sort = p.sort || "popular";
  if (p.kind === "food-category") {
    const foods = DATA.foods.filter((f) => f.category === p.key).sort((a, b) => tscore(b) - tscore(a));
    return { title: p.key, sub: `음식 분류 · ${foods.length}종`, drinks: [], foods, tags: [], total: foods.length };
  }
  let base: Drink[];
  let sub: string;
  if (p.kind === "category") { base = DATA.drinks.filter((d) => d.category === p.key); sub = "술 종류"; }
  else if (p.kind === "region") { base = DATA.drinks.filter((d) => (d.region || "").includes(p.key)); sub = "지역"; }
  else { base = DATA.drinks.filter((d) => d.brewery === p.key); sub = `양조장 · ${base[0]?.region || ""}`; }
  const total = base.length;
  // 태그 집계(필터 전)
  const tagCount = new Map<string, number>();
  for (const d of base) for (const t of d.flavor || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  const tags = [...tagCount.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  let list = base;
  if (p.abv) { const band = ABV_BANDS.find((b) => b.key === p.abv)!; list = list.filter((d) => band.test(d.abv)); }
  if (p.tag) list = list.filter((d) => (d.flavor || []).includes(p.tag!));
  list = [...list].sort(
    sort === "popular" ? byPopular
      : sort === "award" ? (a, b) => (b.awards?.length || 0) - (a.awards?.length || 0) || byPopular(a, b)
      : sort === "abv-asc" ? (a, b) => (a.abv ?? 99) - (b.abv ?? 99)
      : sort === "abv-desc" ? (a, b) => (b.abv ?? -1) - (a.abv ?? -1)
      : (a, b) => a.name.localeCompare(b.name, "ko"),
  );
  return { title: p.key, sub: `${sub} · ${total}종`, drinks: list, foods: [], tags, total };
}
