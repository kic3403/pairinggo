import { describe, expect, it } from "vitest";
import type { Drink, Food, Pairing } from "../types";
import { bandOf, drinkFits, drinkGroup, foodFits, precipOf, sidoOfRegion, sidoShort, situationForDrink, situationForFood, situationOf, situationPairs, WEATHER_GRID } from "../situation";

const drink = (id: string, category: string, abv: number, region = "충남 당진", kind?: Drink["kind"]): Drink => ({ id, name: id, category, abv, region, kind, alias: id, brewery: "", desc: "", flavor: [], blog_anju: 0, buy: { url: null, store: null } }) as Drink;
const food = (id: string, category: string): Food => ({ id, name: id, category, tags: [] }) as Food;
const pair = (d: string, f: string, evs: number): Pairing => ({ d, f, es: 0, reason: "", blog: 0, src: evs ? "media" : "profile", evs, evn: evs ? 1 : 0 }) as Pairing;

describe("시·도", () => {
  it("긴 이름·짧은 이름 → 짧은 이름, 모르면 null", () => {
    expect(sidoShort("서울특별시")).toBe("서울"); expect(sidoShort("전남광주통합특별시")).toBe("전남"); expect(sidoShort("충남")).toBe("충남"); expect(sidoShort("화성")).toBeNull(); expect(sidoShort(null)).toBeNull();
  });
  it("관심 지역 id → 시·도(수도권은 서울, 묶음은 앞쪽, 전국은 없음)", () => {
    expect(sidoOfRegion("cap")).toBe("서울"); expect(sidoOfRegion("gangnam")).toBe("서울"); expect(sidoOfRegion("gg")).toBe("경기"); expect(sidoOfRegion("cc")).toBe("충남"); expect(sidoOfRegion("jj")).toBe("전남"); expect(sidoOfRegion("all")).toBeNull(); expect(sidoOfRegion("x")).toBeNull();
  });
  it("16개 시·도 모두 격자가 있다", () => { expect(Object.keys(WEATHER_GRID)).toHaveLength(16); });
});

describe("판정", () => {
  it("강수형태·기온 구간", () => {
    expect([0, 1, 2, 3, 5, 6, 7, null].map(precipOf)).toEqual(["none", "rain", "rain", "snow", "rain", "rain", "snow", "none"]);
    expect([-2, 4.9, 5, 14.9, 15, 24.9, 25].map((t) => bandOf(t, "spring"))).toEqual(["cold", "cold", "cool", "cool", "warm", "warm", "hot"]);
    expect(bandOf(null, "winter")).toBe("cold"); expect(bandOf(null, "summer")).toBe("hot"); expect(bandOf(null, "autumn")).toBe("cool"); expect(bandOf(null, "spring")).toBe("warm");
  });
  it("비가 오면 기온보다 비가 먼저, 날씨 없으면 계절만", () => {
    const s = situationOf("2026-10-02", { sido: "서울", temp: 18.4, pty: 1, at: "x" });
    expect(s.key).toBe("rain"); expect(s.fromWeather).toBe(true); expect(s.headline).toBe("서울 18℃ · 비 오는 날엔 막걸리에 전"); expect(s.temp).toBe(18.4);
    const c = situationOf("2027-01-10", { sido: "강원", temp: -3, pty: 0, at: "x" });
    expect(c.key).toBe("cold"); expect(c.headline).toContain("강원 -3℃");
    const n = situationOf("2026-07-15");
    expect(n).toMatchObject({ key: "hot", fromWeather: false, sido: null }); expect(n.headline).toBe("더운 날엔 시원하게");
    expect(situationOf("2026-10-02", null, "충남")).toMatchObject({ key: "cool", sido: "충남" });
  });
});

describe("술·음식 맞춤", () => {
  it("비 = 탁주 × 전, 추움 = 고도수·약주·수입 주종 × 국물·회", () => {
    expect(drinkFits("rain", drink("a", "탁주", 6))).toBe(true); expect(drinkFits("rain", drink("a", "약주", 14))).toBe(true); expect(drinkGroup("rain", drink("a", "약주", 14))).toBe(1); expect(drinkFits("rain", drink("a", "증류주", 40))).toBe(false);
    expect(foodFits("rain", food("해물파전", "전"))).toBe(true); expect(foodFits("rain", food("빈대떡", "안주"))).toBe(true); expect(foodFits("rain", food("회", "회"))).toBe(false);
    expect(drinkFits("cold", drink("a", "증류주", 40))).toBe(true); expect(drinkFits("cold", drink("a", "약주", 13))).toBe(true); expect(drinkFits("cold", drink("a", "탁주", 6))).toBe(false); expect(drinkFits("cold", drink("a", "싱글몰트", 43, "", "whisky"))).toBe(true);
    expect(foodFits("cold", food("감자탕", "한식"))).toBe(true); expect(foodFits("cold", food("방어회", "회"))).toBe(true); expect(foodFits("cold", food("평양냉면", "면"))).toBe(false);
    expect(drinkFits("hot", drink("a", "과실주", 12))).toBe(true); expect(drinkFits("hot", drink("a", "증류주", 40))).toBe(false); expect(foodFits("hot", food("물회", "회"))).toBe(true);
    expect(drinkFits("cool", drink("a", "약주", 15))).toBe(true); expect(drinkFits("cool", drink("a", "증류주", 19))).toBe(true); expect(drinkFits("cool", drink("a", "탁주", 6))).toBe(false); expect(foodFits("cool", food("대하구이", "구이"))).toBe(true);
    expect(drinkFits("warm", drink("a", "탁주", 6))).toBe(true); expect(foodFits("warm", food("나물무침", "무침"))).toBe(true);
  });
});

describe("조합 고르기", () => {
  const ds = {
    drinks: [drink("mak", "탁주", 6, "충남 당진"), drink("mak2", "탁주", 7, "경기 포천"), drink("soju", "증류주", 40, "충남 서천"), drink("demo", "탁주", 6, "충남", undefined)],
    foods: [food("해물파전", "전"), food("김치전", "전"), food("회", "회"), food("육포", "마른안주")],
    pairings: [pair("mak", "해물파전", 0.6), pair("mak2", "해물파전", 1.6), pair("mak2", "김치전", 1.2), pair("soju", "회", 1.0), pair("mak", "육포", 1.5), pair("soju", "해물파전", 0), pair("demo", "김치전", 2)],
  };
  ds.drinks[3].demo = true;
  const rain = situationOf("2026-10-02", { sido: "충남", temp: 18, pty: 1, at: "x" });
  it("둘 다 맞는 조합 먼저, 사는 곳 술 먼저, 같은 술·음식은 한 번, 추정·데모 제외", () => {
    const r = situationPairs(ds, rain, { n: 3 });
    expect(r.map((x) => `${x.drink.id}×${x.food.id}`)).toEqual(["mak×해물파전", "mak2×김치전"]);
    expect(r[0]).toMatchObject({ fit: "both", local: true, conf: "weak" });
    expect(r[1]).toMatchObject({ fit: "both", local: false, conf: "confirmed" });
  });
  it("도수가 비슷한 묶음을 돌아가며 — 탁주 → 약주 → 과실주, 묶음이 비면 나머지 순서대로", () => {
    const ds2 = {
      drinks: [drink("mak", "탁주", 6), drink("mak2", "탁주", 7), drink("yak", "약주", 14), drink("fruit", "과실주", 12), drink("yak2", "약주", 13)],
      foods: [food("해물파전", "전"), food("김치전", "전"), food("감자전", "전"), food("육전", "전"), food("빈대떡", "안주")],
      pairings: [pair("mak", "해물파전", 2), pair("mak2", "김치전", 2), pair("yak", "감자전", 1), pair("fruit", "육전", 1), pair("yak2", "빈대떡", 1)],
    };
    const r = situationPairs(ds2, rain, { n: 5 });
    expect(r.map((x) => x.drink.id)).toEqual(["mak", "yak", "fruit", "mak2", "yak2"]);
    expect(situationForFood({ ...ds2, pairings: ds2.pairings.map((p) => ({ ...p, f: "해물파전" })) }, rain, "해물파전", 3)?.items.map((x) => x.drink.id)).toEqual(["mak", "yak", "fruit"]);
  });
  it("사는 곳이 다르면 근거 확인 조합이 먼저", () => {
    const r = situationPairs(ds, rain, { sido: "경기", n: 3 });
    expect(r[0].drink.id).toBe("mak2");
  });
  it("모자라면 음식만 맞는 조합 → 술만 맞는 조합으로 채운다", () => {
    const cold = situationOf("2027-01-05", { sido: "충남", temp: -1, pty: 0, at: "x" });
    const r = situationPairs(ds, cold, { n: 3 });
    expect(r.map((x) => `${x.drink.id}×${x.food.id}:${x.fit}`)).toEqual(["soju×회:both"]);
    const r2 = situationPairs({ ...ds, pairings: [...ds.pairings, pair("mak", "회", 1)] }, cold, { n: 3 });
    expect(r2.map((x) => `${x.drink.id}×${x.food.id}:${x.fit}`)).toEqual(["soju×회:both"]);   // 회는 이미 썼으니 mak×회는 빠진다
  });
  it("술 상세 — 오늘 같은 날의 음식, 없으면 오늘 같은 날의 술일 때만, 둘 다 아니면 null", () => {
    expect(situationForDrink(ds, rain, "mak")?.items.map((x) => x.food.id)).toEqual(["해물파전"]);
    expect(situationForDrink(ds, rain, "mak2", 1)?.items.map((x) => x.food.id)).toEqual(["해물파전"]);
    expect(situationForDrink(ds, rain, "soju")).toBeNull();                       // 증류주 × 해물파전은 추정이라 빠지고 회는 비 음식이 아님
    const cold = situationOf("2027-01-05", { sido: "충남", temp: -1, pty: 0, at: "x" });
    expect(situationForDrink(ds, cold, "soju")).toMatchObject({ self: true, items: [{ food: { id: "회" }, fit: "both" }] });
    expect(situationForDrink(ds, cold, "mak")).toBeNull();
  });
  it("음식 상세 — 오늘 같은 날의 술, 사는 곳 술 먼저", () => {
    expect(situationForFood(ds, rain, "해물파전", 2, "경기")?.items.map((x) => x.drink.id)).toEqual(["mak2", "mak"]);
    expect(situationForFood(ds, rain, "해물파전", 2, "충남")?.items.map((x) => x.drink.id)).toEqual(["mak", "mak2"]);
    expect(situationForFood(ds, rain, "육포")).toMatchObject({ self: false, items: [{ drink: { id: "mak" }, fit: "drink" }] });
    const cold = situationOf("2027-01-05", null, "충남");
    expect(situationForFood(ds, cold, "육포")).toBeNull();
  });
});
