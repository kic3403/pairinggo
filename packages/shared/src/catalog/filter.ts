/**
 * 술 목록 필터 엔진(2026-09-24) — 모든 주종·'전체' 탭이 같은 규칙을 쓴다. 순수 함수, 화면·API가 함께 부른다.
 *
 * 규칙(요구사항 §3~§6·§12):
 *  · Range { min, max } — max: null = **상한 없음**(300,000원 유한 상한과 구분). 경계는 포함.
 *  · 가격·용량은 **같은 규격(한 병)** 에서 동시에 충족해야 한다. 375mL 3만 + 750mL 5.5만인 술은 "4만 이하 + 700~800mL"에 안 걸린다.
 *  · 조건이 없으면 미확인(null) 규격·규격 없는 술도 보인다. 조건이 켜지면 미확인은 빠진다(0으로 취급하지 않는다).
 *  · 같은 그룹 안 여러 값은 OR, 그룹끼리는 AND. 세부 종류 칩은 단일 선택.
 *  · 결과 수 = 술 수(규격 중복 합침). 카드는 조건을 충족한 규격 중 최저 참고가격과 그 용량.
 *  · 정렬: 가격순은 카드 표시가격과 같은 값, 가격 없는 술은 마지막.
 */
import { byDrink, tscore } from "../data";
import { byKoName } from "../food-groups";
import type { Drink, DrinkKind, DrinkSpec, Food } from "../types";
import { DRINK_KINDS, FOOD_FILTERS, KIND_BY_ID, KIND_IDS, KIND_LABEL, cleanKind, findSubtype, foodMatchesFilter, inSubtype, kindOf, type AttrDef } from "./kinds";
import { bottleSpecs, fmtKrw, fmtMl, parseKrw, parseMl, specPrice } from "./specs";

export type Range = { min: number | null; max: number | null };
export type DrinkSort = "name" | "price-asc" | "price-desc" | "popular" | "newest";
export const SORT_LABELS: Record<DrinkSort, string> = { name: "가나다순", "price-asc": "낮은 가격순", "price-desc": "높은 가격순", popular: "인기순", newest: "최신순" };

export type DrinkFilter = {
  kind: DrinkKind | null;
  /** 세부 종류 id(Subtype.id 또는 children id) */
  cat: string | null;
  q: string;
  price: Range; ml: Range; abv: Range;
  food: string[]; country: string[]; flavor: string[];
  /** 주종별 속성 필터 — key → 선택값(옵션 id·구간 id·"1")들 */
  attrs: Record<string, string[]>;
  /** 전통주: 지역 id(관심지역)·양조장 — 옛 링크 호환 */
  region: string | null; brewery: string | null;
  sort: DrinkSort;
};
export const EMPTY_RANGE: Range = { min: null, max: null };
export const emptyFilter = (): DrinkFilter => ({ kind: null, cat: null, q: "", price: { ...EMPTY_RANGE }, ml: { ...EMPTY_RANGE }, abv: { ...EMPTY_RANGE }, food: [], country: [], flavor: [], attrs: {}, region: null, brewery: null, sort: "name" });

export const rangeActive = (r: Range) => r.min != null || r.max != null;
export const rangeHas = (r: Range, v: number | null | undefined) => (v == null ? !rangeActive(r) : (r.min == null || v >= r.min) && (r.max == null || v <= r.max));
export const rangeValid = (r: Range) => r.min == null || r.max == null || r.min <= r.max;

/* ---------- URL ↔ 필터 (왕복 동일) ---------- */
type Params = { get(k: string): string | null; getAll?(k: string): string[] } | Record<string, string | string[] | undefined>;
const getter = (p: Params) => {
  if (typeof (p as { get?: unknown }).get === "function") { const s = p as URLSearchParams; return (k: string) => s.get(k); }
  return (k: string) => { const v = (p as Record<string, string | string[] | undefined>)[k]; return Array.isArray(v) ? v[0] ?? null : v ?? null; };
};
const intParam = (v: string | null, parse: (x: unknown) => number | null) => (v == null || v === "" ? null : parse(v));
const listParam = (v: string | null) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20) : []);
const ABV_MAX = 80;

/** URL 검색 파라미터 → 필터. 잘못된 값(음수·문자·범위 밖)은 무시. 옛 링크 ?category=탁주·?region=·?brewery= 도 받는다 */
export function parseFilter(p: Params): DrinkFilter {
  const g = getter(p);
  const f = emptyFilter();
  const kind = g("kind");
  f.kind = kind && KIND_IDS.includes(kind as DrinkKind) ? (kind as DrinkKind) : null;
  const cat = g("cat");
  // 옛 링크 ?category=탁주 → 전통주 탭의 그 세부 종류
  const oldCat = g("category");
  if (cat && f.kind && findSubtype(f.kind, cat)) f.cat = cat;
  else if (cat && !f.kind) { for (const k of DRINK_KINDS) if (findSubtype(k.id, cat)) { f.kind = k.id; f.cat = cat; break; } }
  else if (oldCat) { const s = KIND_BY_ID.trad.subtypes.find((x) => x.categories.includes(oldCat)); if (s) { f.kind = "trad"; f.cat = s.id; } }
  f.q = (g("q") || "").trim().slice(0, 80);
  f.price = { min: intParam(g("pmin"), parseKrw) ?? (g("pmin") === "0" ? 0 : null), max: intParam(g("pmax"), parseKrw) };
  f.ml = { min: intParam(g("vmin"), parseMl) ?? (g("vmin") === "0" ? 0 : null), max: intParam(g("vmax"), parseMl) };
  const abv = (v: string | null) => { const n = v == null || v === "" ? NaN : Number(v); return Number.isFinite(n) && n >= 0 && n <= ABV_MAX ? n : null; };
  f.abv = { min: abv(g("amin")), max: abv(g("amax")) };
  // min 0은 조건 없음과 같다(0 이상은 전부)
  if (f.price.min === 0) f.price.min = null;
  if (f.ml.min === 0) f.ml.min = null;
  if (f.abv.min === 0) f.abv.min = null;
  f.food = listParam(g("food")).filter((id) => FOOD_FILTERS.some((x) => x.id === id));
  f.country = listParam(g("country"));
  f.flavor = listParam(g("flavor"));
  const attrDefs = f.kind ? KIND_BY_ID[f.kind].attrs.filter((a) => a.filter) : [];
  for (const a of attrDefs) { const v = listParam(g(`a.${a.key}`)); if (v.length) f.attrs[a.key] = v; }
  f.region = g("region")?.trim() || null;
  f.brewery = g("brewery")?.trim() || null;
  const sort = g("sort");
  f.sort = sort && sort in SORT_LABELS ? (sort as DrinkSort) : "name";
  return f;
}
/** 필터 → URL 검색 파라미터(기본값은 생략). 상한 없음은 키를 빼서 표현한다 — 유한한 숫자로 바꾸지 않는다 */
export function toSearchParams(f: DrinkFilter): URLSearchParams {
  const q = new URLSearchParams();
  if (f.q) q.set("q", f.q);
  if (f.kind) q.set("kind", f.kind);
  if (f.cat) q.set("cat", f.cat);
  if (f.price.min != null) q.set("pmin", String(f.price.min));
  if (f.price.max != null) q.set("pmax", String(f.price.max));
  if (f.ml.min != null) q.set("vmin", String(f.ml.min));
  if (f.ml.max != null) q.set("vmax", String(f.ml.max));
  if (f.abv.min != null) q.set("amin", String(f.abv.min));
  if (f.abv.max != null) q.set("amax", String(f.abv.max));
  if (f.food.length) q.set("food", f.food.join(","));
  if (f.country.length) q.set("country", f.country.join(","));
  if (f.flavor.length) q.set("flavor", f.flavor.join(","));
  for (const [k, v] of Object.entries(f.attrs)) if (v.length) q.set(`a.${k}`, v.join(","));
  if (f.region) q.set("region", f.region);
  if (f.brewery) q.set("brewery", f.brewery);
  if (f.sort !== "name") q.set("sort", f.sort);
  return q;
}
export const filterHref = (f: DrinkFilter, base = "/drinks") => { const s = toSearchParams(f).toString(); return s ? `${base}?${s}` : base; };

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

/** 주종 전환 — 가격·용량·도수·음식·검색어·정렬은 유지, 세부 종류·주종 속성은 해제, 국가는 새 주종 목록에 있는 값만 유지. 지역·양조장은 전통주에서만 */
export function switchKind(f: DrinkFilter, kind: DrinkKind | null): DrinkFilter {
  const countries = kind ? KIND_BY_ID[kind].countries.map((c) => c.id) : null;
  return {
    ...f, kind, cat: null, attrs: {},
    country: countries ? f.country.filter((c) => countries.includes(c)) : f.country,
    region: kind === "trad" || kind == null ? f.region : null, brewery: kind === "trad" || kind == null ? f.brewery : null,
  };
}
/** 초기화 — 상세 조건만 비우고 검색어·주종은 유지 */
export const resetDetails = (f: DrinkFilter): DrinkFilter => ({ ...emptyFilter(), q: f.q, kind: f.kind, sort: f.sort });

/* ---------- 요약·칩 ---------- */
const man = (n: number) => (n % 10000 === 0 ? `${n / 10000}만원` : n % 1000 === 0 && n >= 10000 ? `${(n / 10000).toString()}만원`.replace(/\.(\d)만원/, "만$1천원") : fmtKrw(n));
export const krwShort = (n: number) => (n >= 10000 ? man(n) : fmtKrw(n));
/** 가격 버튼 요약 — "3만~7만원" · "20만원 이상" · "5만원 이하" · 없으면 "가격" */
export function priceSummary(r: Range): string {
  if (!rangeActive(r)) return "가격";
  if (r.min != null && r.max != null) return `${krwShort(r.min).replace(/원$/, "")}~${krwShort(r.max)}`;
  if (r.min != null) return `${krwShort(r.min)} 이상`;
  return `${krwShort(r.max!)} 이하`;
}
/** 용량 버튼 요약 — "500~750mL" · "720mL"(정확) · "1,000mL 이상" · 없으면 "용량" */
export function mlSummary(r: Range): string {
  if (!rangeActive(r)) return "용량";
  if (r.min != null && r.max != null) return r.min === r.max ? fmtMl(r.min) : `${r.min.toLocaleString("ko-KR")}~${fmtMl(r.max)}`;
  if (r.min != null) return `${fmtMl(r.min)} 이상`;
  return `${fmtMl(r.max!)} 이하`;
}
export function abvSummary(r: Range): string {
  if (!rangeActive(r)) return "도수";
  if (r.min != null && r.max != null) return `${r.min}~${r.max}%`;
  return r.min != null ? `${r.min}% 이상` : `${r.max}% 이하`;
}

export type Chip = { key: string; label: string; remove: DrinkFilter };
/** 적용된 조건 칩 — 각각 그 조건만 뺀 필터를 들고 있다. 검색어·주종·정렬은 칩이 아니다 */
export function filterChips(f: DrinkFilter): Chip[] {
  const out: Chip[] = [];
  if (f.cat && f.kind) { const s = findSubtype(f.kind, f.cat); if (s) out.push({ key: "cat", label: s.label, remove: { ...f, cat: null } }); }
  if (rangeActive(f.price)) out.push({ key: "price", label: priceSummary(f.price), remove: { ...f, price: { ...EMPTY_RANGE } } });
  if (rangeActive(f.ml)) out.push({ key: "ml", label: mlSummary(f.ml), remove: { ...f, ml: { ...EMPTY_RANGE } } });
  for (const id of f.food) { const d = FOOD_FILTERS.find((x) => x.id === id); if (d) out.push({ key: `food:${id}`, label: d.label, remove: { ...f, food: f.food.filter((x) => x !== id) } }); }
  for (const id of f.country) { const label = (f.kind ? KIND_BY_ID[f.kind] : null)?.countries.find((c) => c.id === id)?.label ?? DRINK_KINDS.flatMap((k) => k.countries).find((c) => c.id === id)?.label ?? id; out.push({ key: `country:${id}`, label, remove: { ...f, country: f.country.filter((x) => x !== id) } }); }
  if (rangeActive(f.abv)) out.push({ key: "abv", label: `도수 ${abvSummary(f.abv)}`, remove: { ...f, abv: { ...EMPTY_RANGE } } });
  for (const t of f.flavor) out.push({ key: `flavor:${t}`, label: t, remove: { ...f, flavor: f.flavor.filter((x) => x !== t) } });
  if (f.kind) for (const a of KIND_BY_ID[f.kind].attrs) for (const v of f.attrs[a.key] || []) {
    const label = a.type === "bool" ? a.label : a.options?.find((o) => o.id === v)?.label ?? a.bands?.find((b) => b.id === v)?.label ?? v;
    const rest = (f.attrs[a.key] || []).filter((x) => x !== v);
    const attrs = { ...f.attrs }; if (rest.length) attrs[a.key] = rest; else delete attrs[a.key];
    out.push({ key: `a.${a.key}:${v}`, label: a.type === "bool" ? label : `${a.label} ${label}`, remove: { ...f, attrs } });
  }
  if (f.brewery) out.push({ key: "brewery", label: f.brewery, remove: { ...f, brewery: null } });
  return out;
}
export const hasDetails = (f: DrinkFilter) => filterChips(f).length > 0 || !!f.region;

/* ---------- 슬라이더 규칙 ---------- */
export const PRICE_SLIDER = { max: 300_000, step: 1_000 };
export const ML_SLIDER = { max: 3_000, step: 10 };
/** 입력값이 기본 눈금을 넘으면 눈금 끝을 넓힌다(다음 큰 단위로) — 입력값과 슬라이더가 어긋나지 않게 */
export function sliderMax(base: number, step: number, ...values: (number | null)[]): number {
  const top = Math.max(base, ...values.filter((v): v is number => v != null));
  if (top <= base) return base;
  const unit = step * 100;
  return Math.ceil(top / unit) * unit;
}
export const PRICE_QUICK: { id: string; label: string; range: Range }[] = [
  { id: "all", label: "전체", range: { min: null, max: null } },
  { id: "u3", label: "3만원 이하", range: { min: null, max: 30_000 } },
  { id: "3-5", label: "3만~5만원", range: { min: 30_000, max: 50_000 } },
  { id: "5-10", label: "5만~10만원", range: { min: 50_000, max: 100_000 } },
  { id: "10-20", label: "10만~20만원", range: { min: 100_000, max: 200_000 } },
  { id: "20", label: "20만원 이상", range: { min: 200_000, max: null } },
];
export const ML_QUICK = [180, 200, 300, 330, 360, 375, 500, 700, 720, 750, 1000, 1500, 1800];
/** 현재 결과에 실제로 있는 용량(많은 순) — 자주 쓰는 용량 버튼 앞쪽에 먼저 보인다 */
export function presentVolumes(items: FilterItem[], n = 6): number[] {
  const c = new Map<number, number>();
  for (const it of items) for (const s of bottleSpecs(it.drink.specs)) if (s.ml != null) c.set(s.ml, (c.get(s.ml) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([ml]) => ml);
}
export const sameRange = (a: Range, b: Range) => a.min === b.min && a.max === b.max;

/** 주종 탭 목록 — 전체 + 4주종 */
export const kindTabs = (counts: Record<DrinkKind, number>, all: number) => [
  { id: null as DrinkKind | null, label: "전체", n: all },
  ...KIND_IDS.map((k) => ({ id: k as DrinkKind | null, label: KIND_LABEL[k], n: counts[k] })),
];
export { cleanKind };
