import { describe, expect, it } from "vitest";
import { comboPlaceIndex, comboPlaceLabel, soldItems } from "../place-combos";
import type { PlaceInfo } from "../place-info";

const info = (x: Partial<PlaceInfo>): PlaceInfo => ({
  parking: null, parkingNote: "", corkage: null, corkageNote: "", room: null, roomNote: "", drinks: [], drinkNames: [], foods: [], menuNames: [],
  menuNote: "", naverUrl: null, menuItems: [], drinkItems: [], source: "partner", verifiedAt: null, ...x,
});
const drinks = [{ id: "d11", name: "한산소곡주" }, { id: "d2", name: "화요" }];
const foods = [{ id: "f08", name: "해물파전" }, { id: "f20", name: "육회" }];
const pairs = new Set(["d11|f08", "d11|f20"]);

describe("이 조합을 파는 식당", () => {
  it("술 표·메뉴 이름에서 카탈로그 술·음식을 찾는다(음료·기타 메뉴는 음식이 아니다, 3자 미만 술 이름은 이름으로 찾지 않는다)", () => {
    const s = soldItems(info({ drinkItems: [{ name: "한산소곡주 700ml", desc: "", volume: "", abv: null, price: null } as never, { name: "화요 25", desc: "", volume: "", abv: null, price: null } as never], menuItems: [{ name: "해물파전(대)", desc: "", price: 18000 }, { name: "육회 에이드", desc: "", price: 5000, section: "beverage" }] }), drinks, foods);
    expect([...s.drinks]).toEqual(["d11"]);
    expect([...s.foods]).toEqual(["f08"]);
  });
  it("공개 조합만, 같은 매장은 한 번, 이름순", () => {
    const idx = comboPlaceIndex([
      { id: "2", name: "나주막", info: info({ drinks: ["d11"], foods: ["f08", "f20"] }) },
      { id: "1", name: "가람", info: info({ drinks: ["d11", "d2"], menuNames: ["해물파전"] }) },
      { id: "3", name: "술만", info: info({ drinks: ["d11"] }) },
    ], { drinks, foods, pairs });
    expect(idx.get("d11|f08")?.map((p) => p.name)).toEqual(["가람", "나주막"]);
    expect(idx.get("d11|f20")?.map((p) => p.id)).toEqual(["2"]);
    expect(idx.has("d2|f08")).toBe(false);
    expect(comboPlaceLabel(idx.get("d11|f08")!)).toBe("함께 파는 곳 2곳 · 가람 외 1");
    expect(comboPlaceLabel(idx.get("d11|f20")!)).toBe("함께 파는 곳 · 나주막");
  });
});
