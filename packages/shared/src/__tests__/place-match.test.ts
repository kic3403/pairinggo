import { describe, expect, it } from "vitest";
import { matchFirst, placeMatch, type PlaceMatchTarget } from "../place-match";
import type { PlaceInfo } from "../place-info";

const info = (x: Partial<PlaceInfo>): PlaceInfo => ({
  parking: null, parkingNote: "", corkage: null, corkageNote: "", room: null, roomNote: "", drinks: [], drinkNames: [], foods: [], menuNames: [],
  menuNote: "", naverUrl: null, menuItems: [], drinkItems: [], source: "partner", verifiedAt: null, ...x,
});
const T: PlaceMatchTarget = {
  drink: { id: "d11", name: "한산소곡주", category: "약주" },
  food: { id: "f08", name: "해물파전", alias: ["파전"] },
  similarFoods: [{ id: "f09", name: "김치전" }, { id: "f10", name: "녹두전" }],
  drinkCatalog: new Map([["d11", { name: "한산소곡주", category: "약주" }], ["d20", { name: "면천두견주", category: "약주" }], ["d30", { name: "지평막걸리", category: "탁주" }]]),
};

describe("고른 조합을 파는 식당", () => {
  it("술 + 같은 음식이 가장 높다(8) — 카탈로그 id든 메뉴판 이름이든", () => {
    expect(placeMatch(info({ drinks: ["d11"], foods: ["f08"] }), T)).toMatchObject({ score: 8, drink: "exact", food: "exact", label: "한산소곡주 · 해물파전 함께 팔아요" });
    expect(placeMatch(info({ drinkItems: [{ name: "한산소곡주", volume: "700ml", abv: 18, price: 25000 }], menuItems: [{ name: "해물파전(대)", desc: "", price: 18000 }] }), T).score).toBe(8);
  });
  it("술 + 비슷한 음식(7) > 술만(6) > 같은 종류 술 + 음식(5)", () => {
    expect(placeMatch(info({ drinks: ["d11"], menuNames: ["김치전"] }), T)).toMatchObject({ score: 7, food: "similar", foodName: "김치전", label: "한산소곡주 있어요 · 비슷한 메뉴 김치전" });
    expect(placeMatch(info({ drinks: ["d11"], menuNames: ["수육"] }), T).score).toBe(6);
    expect(placeMatch(info({ drinks: ["d20"], foods: ["f08"] }), T)).toMatchObject({ score: 5, drink: "kind", drinkName: "면천두견주" });
  });
  it("카탈로그에 없는 술 이름으로 종류 짐작 — 약주", () => {
    expect(placeMatch(info({ drinkNames: ["집에서 빚은 약주"] }), T)).toMatchObject({ drink: "kind", score: 3 });
    expect(placeMatch(info({ drinks: ["d30"] }), T).score).toBe(0);   // 막걸리는 약주와 다른 종류
  });
  it("음식만 — 같은 음식 2, 비슷한 음식 1, 술을 고르지 않았을 때도", () => {
    expect(placeMatch(info({ menuNames: ["해물 파전"] }), T)).toMatchObject({ score: 2, label: "해물파전 메뉴" });
    expect(placeMatch(info({ foods: ["f10"] }), { ...T, drink: null })).toMatchObject({ score: 1, foodName: "녹두전" });
  });
  it("음식 별칭(파전·부침개)은 비슷한 음식으로만, 술은 이름이 들어 있어야 그 술 — 두 글자 미만은 비교 안 함", () => {
    expect(placeMatch(info({ menuNames: ["김치파전(대)"] }), { ...T, drink: null })).toMatchObject({ food: "similar", foodName: "김치파전", label: "비슷한 메뉴 김치파전" });
    expect(placeMatch(info({ drinkNames: ["오크불소곡주"] }), T).drink).not.toBe("exact");
    expect(placeMatch(info({ drinkNames: ["한산소곡주 700ml"] }), T).drink).toBe("exact");
    expect(placeMatch(info({ menuNames: ["전"] }), { ...T, drink: null, food: { id: "f99", name: "전" }, similarFoods: [] }).score).toBe(0);
  });
  it("정보 없는 식당은 0, 순서는 점수 높은 순·같으면 원래 순서", () => {
    expect(placeMatch(null, T).score).toBe(0);
    const s = (n: number) => ({ match: { score: n, drink: null, drinkName: null, food: null, foodName: null, label: "" } });
    const list = [{ id: "a" }, { id: "b", ...s(6) }, { id: "c", ...s(8) }, { id: "d" }, { id: "e", ...s(6) }];
    expect(matchFirst(list).map((x) => x.id)).toEqual(["c", "b", "e", "a", "d"]);
  });
});
