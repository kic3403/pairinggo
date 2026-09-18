import { describe, expect, it } from "vitest";
import { cleanDrinkItems, cleanMenuItems, cleanVolume, formatAbv, formatPrice, itemsToLists, mergeMenuRows, parseAbv, parsePrice } from "../menu-items";

const catalog = { drinks: [{ id: "d11", name: "한산소곡주" }], foods: [{ id: "f08", name: "해물파전" }] };

describe("메뉴판 값 정리", () => {
  it("가격 — 여러 모양을 원으로, 시가·빈칸은 null", () => {
    expect(parsePrice("12,000원")).toBe(12000);
    expect(parsePrice("₩ 9,500")).toBe(9500);
    expect(parsePrice("1.2만")).toBe(12000);
    expect(parsePrice("3만5천")).toBe(35000);
    expect(parsePrice("8천")).toBe(8000);
    expect(parsePrice(15000)).toBe(15000);
    expect(parsePrice("시가")).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice(-1)).toBeNull();
  });
  it("도수·용량·표시", () => {
    expect(parseAbv("13%")).toBe(13);
    expect(parseAbv("6.5 도")).toBe(6.5);
    expect(parseAbv("")).toBeNull();
    expect(parseAbv(120)).toBeNull();
    expect(cleanVolume("750 ML")).toBe("750ml");
    expect(cleanVolume("1.8 l")).toBe("1.8L");
    expect(cleanVolume("잔")).toBe("잔");
    expect(formatPrice(12000)).toBe("12,000원");
    expect(formatPrice(null)).toBe("");
    expect(formatAbv(13)).toBe("13%");
    expect(formatAbv(null)).toBe("");
  });
  it("메뉴·술 표 정리 — 빈 이름·링크·겹침 제거, 없는 칸은 빈값", () => {
    expect(cleanMenuItems([{ name: " 해물 파전 ", desc: "", price: "18,000" }, { name: "해물파전", price: 1 }, { name: "" }, { name: "https://x.kr" }]))
      .toEqual([{ name: "해물 파전", desc: "", price: 18000 }]);
    expect(cleanDrinkItems([{ name: "한산소곡주", volume: "500ml", abv: "18%", price: "25000" }, { name: "한산소곡주", volume: "잔", price: 6000 }, { name: "한산소곡주", volume: "500 ML" }]))
      .toEqual([{ name: "한산소곡주", volume: "500ml", abv: 18, price: 25000 }, { name: "한산소곡주", volume: "잔", abv: null, price: 6000 }]);
  });
});

describe("사진에서 읽은 줄 더하기", () => {
  it("새 줄은 더하고, 있는 줄은 빈칸만 채운다(덮지 않음) — 카탈로그와 같으면 카탈로그 이름으로", () => {
    const cur = { menu: [{ name: "해물파전", desc: "", price: 18000 }], drinks: [{ name: "한산소곡주", volume: "", abv: null, price: null }] };
    const r = mergeMenuRows(cur, [
      { kind: "food", name: "해물 파전", catalogName: "해물파전", desc: "오징어·새우", price: 20000 },
      { kind: "food", name: "도토리묵", catalogName: "지어낸이름", desc: "", price: 12000 },
      { kind: "drink", name: "소곡주", catalogName: "한산소곡주", volume: "700ml", abv: 18, price: 30000 },
      { kind: "drink", name: "생맥주", catalogName: null, volume: "500cc", abv: null, price: 5000 },
    ], catalog);
    expect(r.menu).toEqual([{ name: "해물파전", desc: "오징어·새우", price: 18000 }, { name: "도토리묵", desc: "", price: 12000 }]);
    expect(r.drinks).toEqual([{ name: "한산소곡주", volume: "700ml", abv: 18, price: 30000 }, { name: "생맥주", volume: "500cc", abv: null, price: 5000 }]);
    expect(r.added).toBe(2);
    expect(r.filled).toBe(4);
    expect(cur.menu[0].desc).toBe(""); // 원본은 그대로
  });
  it("표 → 카탈로그 연결 목록", () => {
    expect(itemsToLists([{ name: "해물파전", desc: "", price: null }, { name: "도토리묵", desc: "", price: null }], [{ name: "한산소곡주", volume: "", abv: null, price: null }, { name: "생맥주", volume: "", abv: null, price: null }], catalog))
      .toEqual({ drinkIds: ["d11"], drinkNames: ["생맥주"], foodIds: ["f08"], menuNames: ["도토리묵"] });
  });
});
