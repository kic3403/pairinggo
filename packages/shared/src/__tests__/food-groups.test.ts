import { describe, expect, it } from "vitest";
import { byKoName, FOOD_GROUPS, foodGroupOf } from "../food-groups";
import { DATA } from "../data";

describe("음식 대분류", () => {
  it("카탈로그의 모든 category가 대분류 표에 있다(새 분류가 '기타'로 새지 않게)", () => {
    const cats = [...new Set(DATA.foods.map((f) => f.category))];
    const missing = cats.filter((c) => foodGroupOf(c) === "기타");
    expect(missing).toEqual([]);
  });
  it("구이·전·회·분식·면은 한식, 안주·마른안주·튀김·치킨은 안주·간식", () => {
    for (const c of ["구이", "전", "회", "분식", "면", "무침", "해산물"]) expect(foodGroupOf(c)).toBe("한식");
    for (const c of ["안주", "마른안주", "튀김", "치킨"]) expect(foodGroupOf(c)).toBe("안주·간식");
    expect(foodGroupOf("양식")).toBe("양식");
    expect(foodGroupOf("없는분류")).toBe("기타");
  });
  it("대분류 순서는 한식 → 양식 → 중식 → 일식 → 안주·간식 → 디저트", () => {
    expect(FOOD_GROUPS.map((g) => g.key)).toEqual(["한식", "양식", "중식", "일식", "안주·간식", "디저트"]);
  });
  it("가나다순 정렬", () => {
    expect([{ name: "홍어삼합" }, { name: "감자전" }, { name: "육회" }, { name: "김치전" }].sort(byKoName).map((x) => x.name)).toEqual(["감자전", "김치전", "육회", "홍어삼합"]);
  });
});
