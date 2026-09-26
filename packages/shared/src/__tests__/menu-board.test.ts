import { describe, expect, it } from "vitest";
import { cleanMenuItems, groupMenuBoard, mergeMenuRows } from "../menu-items";
import { kindOfCategory } from "../catalog/kinds";

describe("메뉴판 구분(2026-09-27)", () => {
  it("음료 구분은 남고 음식은 기본값(키 없음)", () => {
    const rows = cleanMenuItems([{ name: "석류탕", price: 18000 }, { name: "오미자차", price: 5000, section: "beverage" }, { name: "콜라", section: "weird" }]);
    expect(rows[0].section).toBeUndefined();
    expect(rows[1].section).toBe("beverage");
    expect(rows[2].section).toBeUndefined();
  });
  it("손님 메뉴판 — 음식·주류(주종별)·음료", () => {
    const g = groupMenuBoard(
      [{ name: "석류탕", desc: "", price: 18000 }, { name: "오미자차", desc: "", price: 5000, section: "beverage" }],
      [{ name: "한산소곡주", volume: "", abv: 18, price: null, category: "약주" }, { name: "글렌 데모", volume: "", abv: 40, price: null, category: "싱글몰트" }, { name: "이름만", volume: "", abv: null, price: null }, { name: "복순도가", volume: "", abv: 6, price: null, category: "탁주" }],
    );
    expect(g.food.map((x) => x.name)).toEqual(["석류탕"]);
    expect(g.beverage.map((x) => x.name)).toEqual(["오미자차"]);
    expect(g.drinks.map((x) => x.label)).toEqual(["전통주", "위스키", "술"]);
    expect(g.drinks[0].rows.map((x) => x.name)).toEqual(["한산소곡주", "복순도가"]);
    expect(kindOfCategory("탁주")).toBe("trad"); expect(kindOfCategory("없음")).toBeNull();
  });
  it("사진 읽기 — 음료 줄은 음료 구분으로 메뉴 표에", () => {
    const m = mergeMenuRows({ menu: [], drinks: [] }, [{ kind: "beverage", name: "수정과", catalogName: null, price: 6000 }, { kind: "food", name: "포계", catalogName: null }], { drinks: [], foods: [] });
    expect(m.menu.map((x) => [x.name, x.section])).toEqual([["수정과", "beverage"], ["포계", undefined]]);
  });
});
