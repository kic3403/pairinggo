import { describe, expect, it } from "vitest";
import { DATA, F } from "../data";
import type { Drink, DrinkSpec, Food } from "../types";
import {
  EMPTY_RANGE, emptyFilter, filterChips, filterDrinks, matchSpec, mlSummary, parseFilter, pickSpec, presentVolumes, priceSummary, resetDetails, sliderMax, sortItems, switchKind, toSearchParams,
} from "../catalog/filter";
import { cleanPrice, cleanSpec, parseKrw, parseMl, specLine } from "../catalog/specs";

const spec = (id: string, ml: number | null, krw: number | null, extra: Partial<DrinkSpec> = {}): DrinkSpec => ({
  id, ml, abv: null, vintage: null, pack: "bottle", bottles: 1, note: null,
  prices: krw != null ? [{ krw, type: "retail", source: "시험", url: null, checked: "2026-09-24" }] : [], ...extra,
});
const drink = (id: string, name: string, specs: DrinkSpec[] | undefined, extra: Partial<Drink> = {}): Drink => ({
  id, name, alias: name, category: "탁주", abv: 6, region: "", brewery: "", desc: "", flavor: [], blog_anju: 0, buy: { url: null, store: null }, ...(specs ? { specs } : {}), ...extra,
});
const FOODS: Record<string, Food> = {};

// 요구사항 §6의 예: A는 375mL 3만 · 750mL 5.5만
const A = drink("dA", "A술", [spec("a1", 375, 30000), spec("a2", 750, 55000)]);
const B = drink("dB", "B술", [spec("b1", 720, 38000)]);
const C = drink("dC", "C술(가격 없음)", [spec("c1", 500, null)]);
const N = drink("dN", "N술(규격 없음)", undefined);
const S = drink("dS", "S세트", [spec("s1", 375, 60000, { pack: "set", bottles: 2 })]);
const BIG = drink("dBig", "큰 술", [spec("g1", 4500, 450000)]);
const ALL = [A, B, C, N, S, BIG];
const f0 = emptyFilter();

describe("규격 판정 — 가격·용량은 같은 규격에서 동시에", () => {
  it("4만 이하 + 700~800mL: A(375=3만, 750=5.5만)는 빠지고 B(720=3.8만)만 남는다", () => {
    const r = filterDrinks(ALL, { ...f0, price: { min: null, max: 40000 }, ml: { min: 700, max: 800 } }, FOODS);
    expect(r.items.map((x) => x.drink.id)).toEqual(["dB"]);
    expect(r.items[0].spec?.ml).toBe(720); expect(r.items[0].price).toBe(38000);
  });
  it("경계 포함 — 3만~5.5만이면 A의 두 규격 모두 충족, 대표는 최저가 375mL 3만", () => {
    const p = pickSpec(A, { min: 30000, max: 55000 }, EMPTY_RANGE);
    expect(p.ok).toBe(true); expect(p.spec?.ml).toBe(375); expect(p.price).toBe(30000);
  });
  it("용량 720 정확 검색(min=max) — 375·750은 빠진다", () => {
    const r = filterDrinks(ALL, { ...f0, ml: { min: 720, max: 720 } }, FOODS);
    expect(r.items.map((x) => x.drink.id)).toEqual(["dB"]);
  });
  it("조건이 없으면 가격 없는 술·규격 없는 술도 보인다(카드는 '정보 없음')", () => {
    const r = filterDrinks(ALL, f0, FOODS);
    expect(r.items.map((x) => x.drink.id).sort()).toEqual(["dA", "dB", "dBig", "dC", "dN", "dS"]);
    expect(specLine(r.items.find((x) => x.drink.id === "dC")!.spec, null)).toBe("500mL · 가격 정보 없음");
    expect(specLine(null, null)).toBe("용량·가격 정보 없음");
  });
  it("가격 조건이 켜지면 가격 미확인(C)·규격 없음(N)은 빠진다 — 0원으로 취급하지 않는다", () => {
    const r = filterDrinks(ALL, { ...f0, price: { min: null, max: 100000 } }, FOODS);
    expect(r.items.map((x) => x.drink.id)).not.toContain("dC");
    expect(r.items.map((x) => x.drink.id)).not.toContain("dN");
    expect(r.items.map((x) => x.drink.id)).toContain("dA");
  });
  it("세트 규격은 기본 한 병 필터에 섞이지 않는다", () => {
    expect(matchSpec(S.specs![0], EMPTY_RANGE, EMPTY_RANGE).ok).toBe(false);
    const r = filterDrinks(ALL, { ...f0, ml: { min: 375, max: 375 } }, FOODS);
    expect(r.items.map((x) => x.drink.id)).toEqual(["dA"]);
  });
  it("상한 없음 — 최소 20만원만 주면 30만원 넘는 술도, 3,000mL 넘는 술도 나온다", () => {
    const r = filterDrinks(ALL, { ...f0, price: { min: 200000, max: null }, ml: { min: 3000, max: null } }, FOODS);
    expect(r.items.map((x) => x.drink.id)).toEqual(["dBig"]);
  });
  it("유한한 직접 입력 상한(50만원)과 상한 없음은 다르다", () => {
    expect(filterDrinks(ALL, { ...f0, price: { min: null, max: 400000 } }, FOODS).items.map((x) => x.drink.id)).not.toContain("dBig");
    expect(filterDrinks(ALL, { ...f0, price: { min: null, max: 500000 } }, FOODS).items.map((x) => x.drink.id)).toContain("dBig");
  });
});

describe("정렬·결과 수", () => {
  it("가격순은 카드 표시가격 기준이고 가격 없는 술은 마지막", () => {
    const items = filterDrinks(ALL, f0, FOODS).items;
    const asc = sortItems(items, "price-asc").map((x) => x.drink.id);
    expect(asc.slice(0, 3)).toEqual(["dA", "dB", "dBig"]);
    expect(asc.slice(-3).sort()).toEqual(["dC", "dN", "dS"]);
    const desc = sortItems(items, "price-desc").map((x) => x.drink.id);
    expect(desc[0]).toBe("dBig"); expect(desc.slice(-3).sort()).toEqual(["dC", "dN", "dS"]);
  });
  it("결과 수는 규격을 합친 술 수 — A는 규격 둘이어도 1", () => {
    const r = filterDrinks([A], { ...f0, price: { min: 20000, max: 60000 } }, FOODS);
    expect(r.total).toBe(1);
  });
  it("주종 탭 수는 주종을 뺀 나머지 조건 기준", () => {
    const W = drink("dW", "위스키", [spec("w1", 700, 90000)], { kind: "whisky", category: "싱글몰트", country: "scotland" });
    const r = filterDrinks([...ALL, W], { ...f0, kind: "trad", price: { min: 80000, max: null } }, FOODS);
    expect(r.kindCounts.whisky).toBe(1); expect(r.kindCounts.trad).toBe(1); expect(r.total).toBe(1);
  });
});

describe("URL ↔ 필터 왕복", () => {
  it("상한 없음은 키가 없고, 유한 상한은 숫자로 남는다", () => {
    const f = { ...f0, price: { min: 200000, max: null }, ml: { min: null, max: 3000 } };
    const q = toSearchParams(f);
    expect(q.get("pmin")).toBe("200000"); expect(q.has("pmax")).toBe(false); expect(q.get("vmax")).toBe("3000");
    const back = parseFilter(q);
    expect(back.price).toEqual({ min: 200000, max: null }); expect(back.ml).toEqual({ min: null, max: 3000 });
  });
  it("전체 왕복 — 주종·세부·속성·음식·정렬", () => {
    const f = { ...f0, kind: "sake" as const, cat: "junmai_ginjo", price: { min: 30000, max: 70000 }, food: ["seafood"], attrs: { styles: ["nama", "nigori"] }, sort: "price-asc" as const, q: "준마이" };
    const back = parseFilter(toSearchParams(f));
    expect(back).toEqual(f);
  });
  it("잘못된 값은 무시 — 음수·문자·범위 밖·모르는 정렬", () => {
    const f = parseFilter(new URLSearchParams("pmin=-5&pmax=abc&vmin=0&vmax=99999999&amin=200&sort=zzz&kind=beer&cat=nope"));
    expect(f.price).toEqual(EMPTY_RANGE); expect(f.ml).toEqual(EMPTY_RANGE); expect(f.abv).toEqual(EMPTY_RANGE);
    expect(f.sort).toBe("name"); expect(f.kind).toBeNull(); expect(f.cat).toBeNull();
  });
  it("옛 링크 ?category=탁주 는 전통주 막걸리·탁주 탭으로", () => {
    const f = parseFilter({ category: "탁주" });
    expect(f.kind).toBe("trad"); expect(f.cat).toBe("makgeolli");
  });
  it("cat만 있으면 주종을 찾아 붙인다", () => {
    const f = parseFilter(new URLSearchParams("cat=single_malt"));
    expect(f.kind).toBe("whisky");
  });
});

describe("주종 전환·초기화·칩·요약", () => {
  const f = { ...f0, kind: "whisky" as const, cat: "bourbon", price: { min: 30000, max: 70000 }, ml: { min: 500, max: 750 }, abv: { min: 40, max: null }, food: ["grill"], country: ["usa", "scotland"], attrs: { peat: ["heavy"] }, q: "글렌" };
  it("주종을 바꾸면 가격·용량·도수·음식·검색어는 남고 세부 종류·속성은 빠진다. 국가는 새 주종에 있는 것만", () => {
    const w = switchKind(f, "wine");
    expect(w.price).toEqual(f.price); expect(w.ml).toEqual(f.ml); expect(w.abv).toEqual(f.abv); expect(w.food).toEqual(["grill"]); expect(w.q).toBe("글렌");
    expect(w.cat).toBeNull(); expect(w.attrs).toEqual({}); expect(w.country).toEqual(["usa"]);   // 와인 국가 목록에 스코틀랜드는 없다
  });
  it("초기화는 검색어·주종을 남기고 상세 조건을 비운다", () => {
    const r = resetDetails(f);
    expect(r.kind).toBe("whisky"); expect(r.q).toBe("글렌"); expect(r.price).toEqual(EMPTY_RANGE); expect(r.food).toEqual([]); expect(r.attrs).toEqual({});
  });
  it("요약 문구", () => {
    expect(priceSummary({ min: 30000, max: 70000 })).toBe("3만~7만원");
    expect(priceSummary({ min: 200000, max: null })).toBe("20만원 이상");
    expect(priceSummary({ min: null, max: 30000 })).toBe("3만원 이하");
    expect(priceSummary(EMPTY_RANGE)).toBe("가격");
    expect(mlSummary({ min: 500, max: 750 })).toBe("500~750mL");
    expect(mlSummary({ min: 720, max: 720 })).toBe("720mL");
    expect(mlSummary({ min: 1000, max: null })).toBe("1,000mL 이상");
  });
  it("칩은 각각 그 조건만 뺀 필터를 든다", () => {
    const chips = filterChips(f);
    expect(chips.map((c) => c.label)).toEqual(["버번", "3만~7만원", "500~750mL", "고기구이", "미국", "스코틀랜드", "도수 40% 이상", "피트·스모키 강함"]);
    const noPrice = chips.find((c) => c.key === "price")!.remove;
    expect(noPrice.price).toEqual(EMPTY_RANGE); expect(noPrice.ml).toEqual(f.ml);
    expect(chips.find((c) => c.key === "country:usa")!.remove.country).toEqual(["scotland"]);
  });
  it("슬라이더 눈금은 입력값이 넘으면 넓어지고, 안 넘으면 기본", () => {
    expect(sliderMax(300000, 1000, 250000)).toBe(300000);
    expect(sliderMax(300000, 1000, 450000)).toBe(500000);
    expect(sliderMax(3000, 10, 4500)).toBe(5000);
    expect(sliderMax(300000, 1000, null)).toBe(300000);
  });
  it("현재 결과에 있는 용량이 먼저", () => {
    expect(presentVolumes(filterDrinks(ALL, f0, FOODS).items)).toEqual([375, 500, 720, 750, 4500]);
  });
});

describe("규격·가격 정리", () => {
  it("용량은 mL 정수로 — 1L·1.8L·720ml·375", () => {
    expect(parseMl("1L")).toBe(1000); expect(parseMl("1.8L")).toBe(1800); expect(parseMl("720ml")).toBe(720); expect(parseMl("375")).toBe(375); expect(parseMl(" 1,000 mL ")).toBe(1000);
    expect(parseMl(0)).toBeNull(); expect(parseMl("")).toBeNull(); expect(parseMl("한 병")).toBeNull(); expect(parseMl(-5)).toBeNull();
  });
  it("가격은 원 정수로 — 0원·미확인은 null", () => {
    expect(parseKrw("38,000원")).toBe(38000); expect(parseKrw("3.8만")).toBe(38000); expect(parseKrw(0)).toBeNull(); expect(parseKrw("시가")).toBeNull();
  });
  it("가격 행은 금액·출처·확인일이 다 있어야 한다", () => {
    expect(cleanPrice({ krw: 38000, source: "키햐", checked: "2026-09-24" })?.type).toBe("retail");
    expect(cleanPrice({ krw: 38000, source: "", checked: "2026-09-24" })).toBeNull();
    expect(cleanPrice({ krw: 0, source: "x", checked: "2026-09-24" })).toBeNull();
    expect(cleanPrice({ krw: 1000, source: "x", checked: "어제" })).toBeNull();
  });
  it("규격은 0mL를 저장하지 않고(null), 세트는 병 수 2 이상", () => {
    expect(cleanSpec({ ml: 0 }).ml).toBeNull();
    expect(cleanSpec({ ml: "1.8L", pack: "set", bottles: 1 })).toMatchObject({ ml: 1800, pack: "set", bottles: 2 });
    expect(cleanSpec({ volume: "720ml", prices: [{ krw: 40000, source: "a", checked: "2026-01-01" }, { krw: 38000, source: "b", checked: "2026-01-02" }] }).prices.map((p) => p.krw)).toEqual([38000, 40000]);
  });
});

describe("음식 필터 — 실제 페어링 데이터", () => {
  it("각 음식 필터에 걸리는 전통주가 카탈로그에 하나 이상 있다", () => {
    for (const id of ["grill", "seafood", "fried", "spicy", "korean", "cheese", "dessert"]) {
      const r = filterDrinks(DATA.drinks, { ...f0, food: [id] }, F);
      expect(r.total, id).toBeGreaterThan(0);
    }
  });
  it("음식 필터 안 여러 값은 OR", () => {
    const a = filterDrinks(DATA.drinks, { ...f0, food: ["cheese"] }, F).total;
    const b = filterDrinks(DATA.drinks, { ...f0, food: ["dessert"] }, F).total;
    const ab = filterDrinks(DATA.drinks, { ...f0, food: ["cheese", "dessert"] }, F).total;
    expect(ab).toBeGreaterThanOrEqual(Math.max(a, b));
  });
});
