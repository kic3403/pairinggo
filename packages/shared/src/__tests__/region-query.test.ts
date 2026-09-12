import { describe, expect, it } from "vitest";
import { DATA } from "../data";
import { parseRegionQuery } from "../search/region";

const drinks = DATA.drinks;

describe("parseRegionQuery — 지역 + 전통주 검색", () => {
  it("'부산 전통주' → 부산 술 전부, 양조장 묶음", () => {
    const r = parseRegionQuery("부산 전통주", drinks)!;
    expect(r).not.toBeNull();
    expect(r.label).toBe("부산");
    expect(r.drinks.length).toBe(drinks.filter((d) => (d.region || "").startsWith("부산")).length);
    expect(r.drinks.every((d) => d.region?.startsWith("부산"))).toBe(true);
    expect(r.breweries.length).toBeGreaterThan(0);
    expect(r.category).toBeNull();
  });
  it("'경기 막걸리' → 경기 탁주만", () => {
    const r = parseRegionQuery("경기 막걸리", drinks)!;
    expect(r.categoryLabel).toBe("막걸리");
    expect(r.drinks.length).toBeGreaterThan(0);
    expect(r.drinks.every((d) => d.region?.startsWith("경기") && d.category === "탁주")).toBe(true);
  });
  it("별칭·조사: '경기도의 소주', '충청도 술', '수도권 양조장'", () => {
    expect(parseRegionQuery("경기도의 소주", drinks)!.drinks.every((d) => d.category === "증류주" && d.region?.startsWith("경기"))).toBe(true);
    const cc = parseRegionQuery("충청도 술", drinks)!;
    expect(cc.label).toBe("충청도");
    expect(cc.drinks.every((d) => /^충[남북]/.test(d.region || ""))).toBe(true);
    expect(cc.drinks.length).toBe(drinks.filter((d) => /^충[남북]/.test(d.region || "")).length);
    expect(parseRegionQuery("수도권 양조장", drinks)!.drinks.every((d) => /^(서울|경기|인천)/.test(d.region || ""))).toBe(true);
  });
  it("시군구 단어: '양평 막걸리'는 region에 양평이 든 탁주", () => {
    const r = parseRegionQuery("양평 막걸리", drinks)!;
    expect(r).not.toBeNull();
    expect(r.drinks.length).toBeGreaterThan(0);
    expect(r.drinks.every((d) => d.region?.includes("양평") && d.category === "탁주")).toBe(true);
  });
  it("지역 검색이 아닌 것 — 술 이름·상황·지역 한 단어", () => {
    expect(parseRegionQuery("복순도가", drinks)).toBeNull();
    expect(parseRegionQuery("부산", drinks)).toBeNull();               // 둘러보기가 처리
    expect(parseRegionQuery("매운 안주에 어울리는 술", drinks)).toBeNull();
    expect(parseRegionQuery("부산 복순도가", drinks)).toBeNull();
  });
});
