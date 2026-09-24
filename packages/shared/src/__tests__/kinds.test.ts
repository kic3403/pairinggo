import { describe, expect, it } from "vitest";
import { DATA } from "../data";
import type { Drink } from "../types";
import { DRINK_KINDS, FOOD_FILTERS, KIND_BY_ID, categoryForSubtype, findSubtype, inSubtype, kindOf, subtypeLabel, subtypesOf } from "../catalog/kinds";
import { emptyFilter, filterDrinks } from "../catalog/filter";
import { kindOfQuery } from "../search/normalize";
import { search } from "../search";
import * as data from "../data";
import { afterEach } from "vitest";

const base = (extra: Partial<Drink>): Drink => ({ id: "x", name: "x", alias: "x", category: "", abv: null, region: "", brewery: "", desc: "", flavor: [], blog_anju: 0, buy: { url: null, store: null }, ...extra });

describe("주종 설정 정합성", () => {
  it("세부 종류 id는 주종 안에서 유일하고 영문 slug", () => {
    for (const k of DRINK_KINDS) {
      const ids = k.subtypes.flatMap((s) => [s.id, ...(s.children ?? []).map((c) => c.id)]);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
      for (const c of k.countries) expect(c.id).toMatch(/^[a-z_]+$/);
      const attrKeys = k.attrs.map((a) => a.key);
      expect(new Set(attrKeys).size).toBe(attrKeys.length);
    }
  });
  it("전통주 세부 종류가 카탈로그의 category 값을 전부 덮는다(새 category는 여기에 넣는다)", () => {
    const cats = new Set(DATA.drinks.filter((d) => kindOf(d) === "trad").map((d) => d.category));
    const covered = new Set(KIND_BY_ID.trad.subtypes.flatMap((s) => s.categories));
    for (const c of cats) expect(covered.has(c), c).toBe(true);
  });
  it("기존 전통주는 kind 없이도 전통주로 읽히고 라벨은 category 그대로", () => {
    const d = DATA.drinks[0];
    expect(kindOf(d)).toBe("trad");
    expect(subtypeLabel(base({ category: "탁주" }))).toBe("막걸리·탁주");
    expect(subtypeLabel(base({ category: "허니와인" }))).toBe("리큐르·기타");
    expect(inSubtype(base({ category: "브랜디" }), "liqueur")).toBe(true);
  });
  it("위스키: 그레인 세부(싱글그레인)는 부모 '그레인'에도 걸린다. 버번은 미국 위스키 전체가 아니다", () => {
    const d = base({ kind: "whisky", category: "싱글그레인", country: "scotland" });
    expect(inSubtype(d, "grain")).toBe(true); expect(inSubtype(d, "single_grain")).toBe(true); expect(inSubtype(d, "bourbon")).toBe(false);
    const us = base({ kind: "whisky", category: "라이", country: "usa" });
    expect(inSubtype(us, "bourbon")).toBe(false);
    expect(categoryForSubtype("whisky", "single_malt")).toBe("싱글몰트");
    expect(findSubtype("whisky", "corn")?.label).toBe("콘 위스키");
  });
  it("사케: 특정명칭(category)과 제조 특징(styles)을 동시에 — 준마이 긴조 + 나마 + 니고리", () => {
    const d = base({ kind: "sake", category: "준마이 긴조", attrs: { styles: ["nama", "nigori"] }, country: "japan" });
    const f = { ...emptyFilter(), kind: "sake" as const, cat: "junmai_ginjo", attrs: { styles: ["nigori"] } };
    expect(filterDrinks([d], f, {}).total).toBe(1);
    expect(filterDrinks([d], { ...f, attrs: { styles: ["koshu"] } }, {}).total).toBe(0);
    expect(filterDrinks([d], { ...f, cat: "junmai" }, {}).total).toBe(0);
    // 미확인 사케는 후쓰슈로 분류하지 않는다 — category 빈칸이면 '미확인'
    expect(subtypeLabel(base({ kind: "sake", category: "" }))).toBe("미확인");
  });
  it("와인: 로제 스파클링은 로제와 스파클링 둘 다에서 보인다. 샴페인은 스타일이지 스파클링의 동의어가 아니다", () => {
    const d = base({ kind: "wine", category: "로제", attrs: { sparkling: true, grapes: ["pinot_noir"] }, country: "france" });
    expect(subtypesOf(d).map((s) => s.id).sort()).toEqual(["rose", "sparkling"]);
    expect(inSubtype(d, "rose")).toBe(true); expect(inSubtype(d, "sparkling")).toBe(true); expect(inSubtype(d, "red")).toBe(false);
    const still = base({ kind: "wine", category: "레드", attrs: { sparkling: false } });
    expect(inSubtype(still, "sparkling")).toBe(false);
    expect(filterDrinks([d, still], { ...emptyFilter(), kind: "wine", attrs: { grapes: ["pinot_noir"] } }, {}).total).toBe(1);
    expect(filterDrinks([d, still], { ...emptyFilter(), kind: "wine", attrs: { style: ["champagne"] } }, {}).total).toBe(0);
  });
  it("숙성 연수 미상(NAS)과 숫자 구간, 빈티지 NV를 구분한다", () => {
    const nas = base({ kind: "whisky", category: "블렌디드", attrs: { age: null, nas: true } });
    const y12 = base({ kind: "whisky", category: "싱글몰트", attrs: { age: 12 } });
    const q = (bands: string[]) => filterDrinks([nas, y12], { ...emptyFilter(), kind: "whisky", attrs: { age: bands } }, {}).items.map((x) => x.drink.category);
    expect(q(["nas"])).toEqual(["블렌디드"]); expect(q(["10-15"])).toEqual(["싱글몰트"]); expect(q(["nas", "10-15"]).length).toBe(2);
  });
  it("맛 프로필 단계 필터(전통주 단맛)는 profile 값으로", () => {
    const sweet = base({ category: "탁주", profile: { sweet: 5, acid: 2, body: 3, fizz: 3, aroma: 3 } });
    const dry = base({ id: "y", category: "탁주", profile: { sweet: 1, acid: 2, body: 3, fizz: 3, aroma: 3 } });
    expect(filterDrinks([sweet, dry], { ...emptyFilter(), kind: "trad", attrs: { sweet: ["high"] } }, {}).total).toBe(1);
  });
  it("음식 필터 정의는 실제 음식과 하나 이상 맞는다", () => {
    for (const def of FOOD_FILTERS) {
      const n = DATA.foods.filter((f) => (def.categories?.includes(f.category)) || def.tags?.some((t) => f.tags.includes(t)) || def.names?.some((x) => f.name.includes(x))).length;
      expect(n, def.id).toBeGreaterThan(0);
    }
  });
});

describe("검색 별칭", () => {
  afterEach(() => data.resetDataset());
  it("주종 낱말을 푼다 — 위스키/whisky/whiskey, 준마이/쥰마이/Junmai, 시라/쉬라즈는 품종(별칭)", () => {
    expect(kindOfQuery("위스키")?.kind).toBe("whisky"); expect(kindOfQuery("whisky")?.kind).toBe("whisky"); expect(kindOfQuery("whiskey")?.kind).toBe("whisky");
    expect(kindOfQuery("준마이")).toEqual({ kind: "sake", cat: "junmai" }); expect(kindOfQuery("쥰마이")?.cat).toBe("junmai"); expect(kindOfQuery("junmai")?.cat).toBe("junmai");
    expect(kindOfQuery("아이리시")).toBeNull();   // 생산지 조건이지 종류가 아니다
  });
  it("원어명·품종으로도 술을 찾는다(카탈로그 핫스왑)", () => {
    const ds = JSON.parse(JSON.stringify(data.DATA));
    ds.drinks.push({ ...ds.drinks[0], id: "d998", name: "데모 시라즈 레드", alias: "데모 시라즈", brewery: "", region: "", awards: [], trend: undefined, kind: "wine", category: "레드", country: "australia", nameOrig: "Demo Shiraz", attrs: { grapes: ["syrah"], producer: "Demo Estate" } });
    ds.drinks.push({ ...ds.drinks[0], id: "d997", name: "데모 준마이", alias: "데모 준마이", brewery: "", region: "", awards: [], trend: undefined, kind: "sake", category: "준마이", country: "japan", attrs: { styles: ["nama"] } });
    data.applyDataset(ds, "t");
    expect(search("Demo Shiraz").drinks[0]?.doc.id).toBe("d998");
    expect(search("Demo Estate").drinks.some((h) => h.doc.id === "d998")).toBe(true);
    expect(search("사케").drinks.some((h) => h.doc.id === "d997")).toBe(true);
    expect(search("준마이").browse[0]?.doc.key).toBe("sake:junmai");
    expect(search("와인").drinks.some((h) => h.doc.id === "d998")).toBe(true);
  });
});
