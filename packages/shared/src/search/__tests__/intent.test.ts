import { describe, expect, it } from "vitest";
import { parseIntent, intentSearch } from "../intent";
import { D, F } from "../../data";

describe("상황 검색 파서", () => {
  it("매운 안주에 어울리는 술 → 대상 술, 음식 spice≥3", () => {
    const it = parseIntent("매운 안주에 어울리는 술")!;
    expect(it.target).toBe("drink");
    expect(it.food.profile[0]).toMatchObject({ key: "spice", op: ">=", v: 3 });
    expect(it.explain).toContain("매운 음식");
  });
  it("도수 낮은 달달한 막걸리 → 술, abv≤8, sweet≥4, 탁주", () => {
    const it = parseIntent("도수 낮은 달달한 막걸리")!;
    expect(it.target).toBe("drink");
    expect(it.drink.abv).toMatchObject({ op: "<=", v: 8 });
    expect(it.drink.profile.some((c) => c.key === "sweet" && c.op === ">=")).toBe(true);
    expect(it.drink.category).toBe("탁주");
  });
  it("복순도가에 어울리는 안주 → 대상 음식, 특정 술", () => {
    const it = parseIntent("복순도가에 어울리는 안주")!;
    expect(it.target).toBe("food");
    expect(it.drink.ids).toEqual(["d01"]);
  });
  it("삼겹살이랑 어울리는 술 → 대상 술, 특정 음식", () => {
    const pork = Object.values(F).find((f) => f.name.includes("삼겹"));
    if (!pork) return;
    const it = parseIntent(`${pork.name}이랑 어울리는 술`)!;
    expect(it.target).toBe("drink");
    expect(it.food.ids).toEqual([pork.id]);
  });
  it("선물용 증류주 → 증류주 + 선물", () => {
    const it = parseIntent("선물용 증류주")!;
    expect(it.drink.category).toBe("증류주");
    expect(it.gift).toBe(true);
  });
  it("15도 이하 상큼한 술", () => {
    const it = parseIntent("15도 이하 상큼한 술")!;
    expect(it.drink.abv).toMatchObject({ op: "<=", v: 15 });
    expect(it.drink.profile.some((c) => c.key === "acid")).toBe(true);
  });
  it("회에 어울리는 드라이한 술 → 음식 분류 회 + sweet≤2", () => {
    const it = parseIntent("회에 어울리는 드라이한 술")!;
    expect(it.food.category).toBe("회");
    expect(it.drink.profile.some((c) => c.key === "sweet" && c.op === "<=")).toBe(true);
  });
  it("대통령상 받은 술", () => {
    expect(parseIntent("대통령상 받은 술")!.drink.award).toBe(true);
  });
  it("제주 술 추천", () => {
    expect(parseIntent("제주 술 추천")!.drink.region).toBe("제주");
  });
  it("기름진 음식 → 대상 음식, fat≥4", () => {
    const it = parseIntent("기름진 음식")!;
    expect(it.target).toBe("food");
    expect(it.food.profile[0]).toMatchObject({ key: "fat", op: ">=", v: 4 });
  });
  it("단순 이름은 상황 검색이 아니다", () => {
    expect(parseIntent("복순도가")).toBeNull();
    expect(parseIntent("육회")).toBeNull();
    expect(parseIntent("없는말")).toBeNull();
  });
});

describe("상황 검색 실행", () => {
  it("매운 안주에 어울리는 술 → 페어링 근거가 있는 술 목록", () => {
    const r = intentSearch("매운 안주에 어울리는 술")!;
    expect(r.matchedSubjects).toBeGreaterThan(0);
    expect(r.drinks.length).toBeGreaterThan(0);
    expect(r.drinks[0].via).not.toBeNull();
    expect(r.drinks[0].count).toBeGreaterThanOrEqual(1);
  });
  it("도수 낮은 달달한 막걸리 → 조건을 모두 만족", () => {
    const r = intentSearch("도수 낮은 달달한 막걸리")!;
    expect(r.drinks.length).toBeGreaterThan(0);
    for (const row of r.drinks) {
      expect(row.drink.category).toBe("탁주");
      expect(row.drink.abv!).toBeLessThanOrEqual(8);
      expect(row.drink.profile!.sweet).toBeGreaterThanOrEqual(4);
    }
  });
  it("복순도가에 어울리는 안주 → 복순도가 페어링 순", () => {
    const r = intentSearch("복순도가에 어울리는 안주")!;
    expect(r.foods.length).toBeGreaterThan(0);
    expect(r.foods.every((row) => row.via?.d === "d01")).toBe(true);
  });
  it("선물용 증류주 → 수상작이 앞에 온다", () => {
    const r = intentSearch("선물용 증류주")!;
    expect(r.drinks.length).toBeGreaterThan(0);
    expect(r.drinks.every((row) => row.drink.category === "증류주")).toBe(true);
    if (r.drinks.some((row) => row.drink.awards?.length)) expect(r.drinks[0].drink.awards?.length).toBeGreaterThan(0);
  });
  it("회에 어울리는 드라이한 술 → 회 종류 음식의 페어링", () => {
    const r = intentSearch("회에 어울리는 드라이한 술")!;
    expect(r.matchedSubjects).toBeGreaterThan(0);
    for (const row of r.drinks) expect(row.drink.profile!.sweet).toBeLessThanOrEqual(2);
  });
  it("결과 없는 조건은 빈 배열", () => {
    const r = intentSearch("50도 이상 탄산 막걸리")!;
    expect(r.drinks).toHaveLength(0);
  });
  it("D/F 인덱스 참조 무결", () => {
    expect(D.d01.name).toContain("복순도가");
    expect(F.f01.name).toBe("육회");
  });
});
