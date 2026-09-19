import { describe, expect, it } from "vitest";
import { corkageFee, corkageLabel, matchFirst, placeMatch, type PlaceMatch, type PlaceMatchTarget } from "../place-match";
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
const score = (x: Partial<PlaceInfo>, t = T) => placeMatch(info(x), t).score;

describe("고른 조합을 파는 식당", () => {
  it("그 술 + 같은 음식이 가장 높다 — 카탈로그 id든 메뉴판 이름이든", () => {
    expect(placeMatch(info({ drinks: ["d11"], foods: ["f08"] }), T)).toMatchObject({ score: 90, drink: "exact", food: "exact", label: "한산소곡주 · 해물파전 함께 팔아요" });
    expect(score({ drinkItems: [{ name: "한산소곡주", volume: "700ml", abv: 18, price: 25000 }], menuItems: [{ name: "해물파전(대)", desc: "", price: 18000 }] })).toBe(90);
  });
  it("순위: 술+비슷한 음식 > 같은 음식+콜키지 > 술만 > 비슷한 음식+콜키지 > 같은 종류 술+음식 > 음식만", () => {
    const order = [
      score({ drinks: ["d11"], menuNames: ["김치전"] }),
      score({ foods: ["f08"], corkage: "yes", corkageNote: "병당 1만원" }),
      score({ drinks: ["d11"], menuNames: ["수육"] }),
      score({ menuNames: ["녹두전"], corkage: "yes" }),
      score({ drinks: ["d20"], foods: ["f08"] }),
      score({ menuNames: ["해물파전"] }),
    ];
    expect(order).toEqual([80, 70, 60, 50, 40, 20]);
    expect([...order].sort((a, b) => b - a)).toEqual(order);
  });
  it("같은 음식 + 콜키지 — 고른 술을 가져가는 곳으로 안내", () => {
    expect(placeMatch(info({ menuNames: ["해물파전"], corkage: "yes", corkageNote: "병당 1만원, 전통주 무료" }), T))
      .toMatchObject({ score: 70, corkage: { fee: 0 }, label: "해물파전 메뉴 · 콜키지 무료 — 한산소곡주 가져가기" });
    // 콜키지 불가·정보 없음은 음식만(20), 술을 고르지 않았으면 콜키지는 순위에 안 들어간다
    expect(score({ menuNames: ["해물파전"], corkage: "no" })).toBe(20);
    expect(score({ menuNames: ["해물파전"], corkage: "yes" }, { ...T, drink: null })).toBe(20);
    // 음식이 안 맞으면 콜키지만으로는 올리지 않는다
    expect(score({ menuNames: ["수육"], corkage: "yes" })).toBe(0);
  });
  it("카탈로그에 없는 술 이름으로 종류 짐작 — 약주", () => {
    expect(placeMatch(info({ drinkNames: ["집에서 빚은 약주"] }), T)).toMatchObject({ drink: "kind", score: 25 });
    expect(score({ drinks: ["d30"] })).toBe(0);   // 막걸리는 약주와 다른 종류
  });
  it("음식 별칭(파전)은 비슷한 음식으로만, 술은 이름이 들어 있어야 그 술 — 두 글자 미만은 비교 안 함", () => {
    expect(placeMatch(info({ menuNames: ["김치파전(대)"] }), { ...T, drink: null })).toMatchObject({ score: 10, food: "similar", foodName: "김치파전", label: "비슷한 메뉴 김치파전" });
    expect(placeMatch(info({ drinkNames: ["오크불소곡주"] }), T).drink).not.toBe("exact");
    expect(placeMatch(info({ drinkNames: ["한산소곡주 700ml"] }), T).drink).toBe("exact");
    expect(score({ menuNames: ["전"] }, { ...T, drink: null, food: { id: "f99", name: "전" }, similarFoods: [] })).toBe(0);
  });
});

describe("콜키지 값", () => {
  it("메모에서 병당 값 — 만·천·원, 무료, 전통주 무료", () => {
    expect(corkageFee("병당 1만원")).toBe(10000);
    expect(corkageFee("1만5천원")).toBe(15000);
    expect(corkageFee("병당 15,000원")).toBe(15000);
    expect(corkageFee("5천원")).toBe(5000);
    expect(corkageFee("와인 2만원, 소주 5000원")).toBe(5000);
    expect(corkageFee("무료")).toBe(0);
    expect(corkageFee("병당 1만원, 전통주 무료")).toBe(0);
    expect(corkageFee("병당 1만원, 전통주 무료", false)).toBe(10000);
    expect(corkageFee("사장님께 문의")).toBeNull();
    expect(corkageFee("")).toBeNull();
  });
  it("표시", () => {
    expect([0, 5000, 10000, 15000, 7500, null].map(corkageLabel)).toEqual(["콜키지 무료", "콜키지 5천원", "콜키지 1만원", "콜키지 1.5만원", "콜키지 7,500원", "콜키지 가능"]);
  });
  it("같은 순위는 콜키지 싼 곳부터(무료 → 값 → 값 모름 → 콜키지 없음), 순위가 먼저", () => {
    const m = (score: number, fee?: number | null): { match: PlaceMatch } => ({ match: { score, drink: null, drinkName: null, food: null, foodName: null, corkage: fee === undefined ? null : { fee }, label: "" } });
    const list: { id: string; match?: PlaceMatch }[] = [
      { id: "a" }, { id: "b", ...m(70, 15000) }, { id: "c", ...m(70, null) }, { id: "d", ...m(70, 0) },
      { id: "e", ...m(90) }, { id: "f", ...m(70, 5000) }, { id: "g", ...m(20) },
    ];
    expect(matchFirst(list).map((x) => x.id)).toEqual(["e", "d", "f", "b", "c", "g", "a"]);
  });
});
