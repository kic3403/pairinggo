/**
 * 술 목록 필터 엔진(2026-09-24) — 모든 주종·'전체' 탭이 같은 규칙을 쓴다. 서버(목록 화면·API)가 부른다.
 *  · 가격·용량은 **같은 규격(한 병)** 에서 동시에 충족해야 한다. 375mL 3만 + 750mL 5.5만인 술은 "4만 이하 + 700~800mL"에 안 걸린다.
 *  · 조건이 없으면 미확인(null) 규격·규격 없는 술도 보인다. 조건이 켜지면 미확인은 빠진다(0으로 취급하지 않는다).
 *  · 결과 수 = 술 수(규격 중복 합침). 카드는 조건을 충족한 규격 중 최저 참고가격과 그 용량.
 *  · 정렬: 가격순은 카드 표시가격과 같은 값, 가격 없는 술은 마지막.
 * URL·요약·칩 규칙은 filter-url.ts(클라이언트 공용).
 */
import { byDrink, tscore } from "../data";
import { byKoName } from "../food-groups";
import type { Drink, DrinkKind, DrinkSpec, Food } from "../types";
import { FOOD_FILTERS, KIND_BY_ID, KIND_IDS, foodMatchesFilter, inSubtype, kindOf, type AttrDef } from "./kinds";
import { bottleSpecs, specPrice } from "./specs";
import { rangeActive, rangeHas, type DrinkFilter, type DrinkSort, type Range } from "./filter-url";

export * from "./filter-url";

/* ---------- 규격 판정 ---------- */
/** 한 규격이 가격·용량 조건을 **동시에** 충족하는가 — 조건이 켜졌는데 값이 없으면(null·가격 0건) 불충족 */
export function matchSpec(spec: DrinkSpec, price: Range, ml: Range): { ok: boolean; price: number | null } {
  if (spec.pack !== "bottle") return { ok: false, price: null };
  if (rangeActive(ml) && (spec.ml == null || !rangeHas(ml, spec.ml))) return { ok: false, price: null };
  if (rangeActive(price)) {
    const inRange = spec.prices.filter((p) => rangeHas(price, p.krw));
    if (!inRange.length) return { ok: false, price: null };
    return { ok: true, price: Math.min(...inRange.map((p) => p.krw)) };
  }
  return { ok: true, price: specPrice(spec)?.krw ?? null };
}
/** 술의 대표 규격 — 조건을 충족한 한 병 규격 중 최저 참고가격(가격 없는 규격은 뒤). 조건이 없고 규격도 없으면 null */
export function pickSpec(d: Drink, price: Range, ml: Range): { spec: DrinkSpec | null; price: number | null; ok: boolean } {
  const specs = bottleSpecs(d.specs);
  const active = rangeActive(price) || rangeActive(ml);
  if (!specs.length) return { spec: null, price: null, ok: !active };
  let best: { spec: DrinkSpec; price: number | null } | null = null;
  for (const s of specs) {
    const m = matchSpec(s, price, ml);
    if (!m.ok) continue;
    if (!best || (m.price != null && (best.price == null || m.price < best.price))) best = { spec: s, price: m.price };
  }
  return best ? { ...best, ok: true } : { spec: null, price: null, ok: false };
}

/* ---------- 속성·음식·검색어 ---------- */
const attrMatches = (d: Drink, def: AttrDef, wanted: string[]): boolean => {
  const raw = def.type === "level" ? d.profile?.[def.key as keyof NonNullable<Drink["profile"]>] : d.attrs?.[def.key];
  switch (def.type) {
    case "bool": return wanted.includes("1") ? raw === true : wanted.includes("0") ? raw === false : true;
    case "select": case "text": return wanted.some((w) => String(raw ?? "") === w || (def.type === "text" && String(raw ?? "").includes(w)));
    case "multi": case "tags": { const arr = Array.isArray(raw) ? raw.map(String) : []; return wanted.some((w) => arr.includes(w)); }
    case "int": case "level": {
      const n = raw == null || raw === "" ? null : Number(raw);
      return wanted.some((id) => { const b = def.bands?.find((x) => x.id === id); if (!b) return false; if (b.nullOnly) return n == null || !Number.isFinite(n); return n != null && Number.isFinite(n) && (b.min == null || n >= b.min) && (b.max == null || n <= b.max); });
    }
  }
};
/** 술이 어느 음식 필터에 걸리는지 — 등록된 페어링의 음식으로 */
export function drinkFoodFilters(d: Drink, foods: Record<string, Food>): Set<string> {
  const out = new Set<string>();
  for (const p of byDrink[d.id] || []) { const f = foods[p.f]; if (!f) continue; for (const def of FOOD_FILTERS) if (foodMatchesFilter(f, def)) out.add(def.id); }
  return out;
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const textMatch = (d: Drink, q: string) => {
  const n = norm(q);
  if (!n) return true;
  const hay = [d.name, d.alias, d.nameOrig ?? "", ...(d.aliases ?? []), d.brewery, d.category, ...(d.flavor ?? []), ...(Array.isArray(d.attrs?.grapes) ? (d.attrs!.grapes as unknown[]).map(String) : []), String(d.attrs?.producer ?? ""), String(d.attrs?.distillery ?? "")];
  return hay.some((h) => norm(h).includes(n));
};

/* ---------- 목록 ---------- */
export type FilterItem = { drink: Drink; spec: DrinkSpec | null; price: number | null; foods: string[] };
export type FilterResult = { items: FilterItem[]; total: number; kindCounts: Record<DrinkKind, number>; all: number };

/**
 * 목록 필터 — 전체 데이터에 적용한다(페이지 단위가 아니다). regionTest는 전통주 지역 칩(관심지역 판정)을 화면이 넘긴다.
 */
export function filterDrinks(drinks: Drink[], f: DrinkFilter, foods: Record<string, Food>, opts: { regionTest?: (d: Drink) => boolean } = {}): FilterResult {
  const kindCounts: Record<DrinkKind, number> = { trad: 0, whisky: 0, sake: 0, wine: 0 };
  const items: FilterItem[] = [];
  const attrDefs = f.kind ? KIND_BY_ID[f.kind].attrs.filter((a) => a.filter && f.attrs[a.key]?.length) : [];
  for (const d of drinks) {
    const k = kindOf(d);
    // 주종 탭 수는 주종을 뺀 나머지 조건 기준(탭을 옮겼을 때 몇 종인지 미리 보인다)
    const common = (!f.q || textMatch(d, f.q)) && rangeHas(f.abv, d.abv) && (!f.flavor.length || f.flavor.some((t) => (d.flavor || []).includes(t)));
    if (!common) continue;
    const sp = pickSpec(d, f.price, f.ml);
    if (!sp.ok) continue;
    let foodIds: string[] = [];
    if (f.food.length) { const have = drinkFoodFilters(d, foods); foodIds = f.food.filter((x) => have.has(x)); if (!foodIds.length) continue; }
    kindCounts[k]++;
    if (f.kind && k !== f.kind) continue;
    if (f.cat && !inSubtype(d, f.cat)) continue;
    if (f.country.length && !f.country.includes(d.country || "kr")) continue;
    if (attrDefs.some((a) => !attrMatches(d, a, f.attrs[a.key]))) continue;
    if (f.region && opts.regionTest && !opts.regionTest(d)) continue;
    if (f.brewery && !(d.brewery || "").includes(f.brewery)) continue;
    items.push({ drink: d, spec: sp.spec, price: sp.price, foods: foodIds });
  }
  return { items: sortItems(items, f.sort), total: items.length, kindCounts, all: KIND_IDS.reduce((a, k) => a + kindCounts[k], 0) };
}

export function sortItems(items: FilterItem[], sort: DrinkSort): FilterItem[] {
  const byName = (a: FilterItem, b: FilterItem) => byKoName(a.drink, b.drink);
  const price = (dir: 1 | -1) => (a: FilterItem, b: FilterItem) => {
    if (a.price == null && b.price == null) return byName(a, b);
    if (a.price == null) return 1; if (b.price == null) return -1;   // 가격 없는 술은 마지막
    return (a.price - b.price) * dir || byName(a, b);
  };
  const cmp = sort === "price-asc" ? price(1) : sort === "price-desc" ? price(-1)
    : sort === "popular" ? (a: FilterItem, b: FilterItem) => tscore(b.drink) - tscore(a.drink) || byName(a, b)
    : sort === "newest" ? (a: FilterItem, b: FilterItem) => (b.drink.added || "").localeCompare(a.drink.added || "") || byName(a, b)
    : byName;
  return [...items].sort(cmp);
}

/** 현재 결과에 실제로 있는 용량(많은 순) — 자주 쓰는 용량 버튼 앞쪽에 먼저 보인다 */
export function presentVolumes(items: FilterItem[], n = 6): number[] {
  const c = new Map<number, number>();
  for (const it of items) for (const s of bottleSpecs(it.drink.specs)) if (s.ml != null) c.set(s.ml, (c.get(s.ml) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([ml]) => ml);
}
