import { describe, expect, it } from "vitest";
import type { Drink, Food, Pairing } from "../types";
import { DATA } from "../data";
import { GUIDE_MIN, findGuide, guideContent, guideList } from "../seo/guides";

const drink = (id: string, category: string) => ({ id, name: id, category }) as Drink;
const food = (id: string, category: string) => ({ id, name: id, category }) as Food;
const pair = (d: string, f: string, evs: number): Pairing => ({ d, f, es: 0, reason: "", blog: 0, src: evs ? "media" : "profile", evs, evn: evs ? 1 : 0 }) as Pairing;

describe("모음 화면(가이드)", () => {
  const drinks = [drink("막1", "탁주"), drink("막2", "탁주"), drink("약1", "약주")];
  const foods = [...Array.from({ length: 8 }, (_, i) => food(`전${i}`, "전")), food("회0", "회")];
  const pairings = [
    ...Array.from({ length: 8 }, (_, i) => pair("막1", `전${i}`, i === 0 ? 1.6 : 0.6)),
    pair("막2", "전0", 1), pair("막2", "전1", 0.3), pair("막2", "회0", 1),
    pair("막2", "전5", 0),          // 추정은 세지 않는다
    pair("약1", "전0", 1),
  ];
  const ds = { drinks, foods, pairings };

  it("근거 조합이 GUIDE_MIN개 이상인 종류만 — 술 화면 먼저", () => {
    const list = guideList(ds);
    expect(list.map((g) => g.slug)).toEqual(["막걸리-안주", "전-어울리는-술"]);
    expect(list[0]).toMatchObject({ side: "drink", category: "탁주", n: 11, h1: "막걸리 안주 추천" });
    expect(list[1]).toMatchObject({ side: "food", category: "전", n: 11, h1: "전과 어울리는 술" });
    expect(GUIDE_MIN).toBe(10);
  });
  it("주소로 찾기 — 하이픈·인코딩 무시", () => {
    expect(findGuide(ds, encodeURIComponent("막걸리-안주"))?.category).toBe("탁주");
    expect(findGuide(ds, "전어울리는술")?.side).toBe("food");
    expect(findGuide(ds, "없는-화면")).toBeUndefined();
  });
  it("술 종류 화면 — 음식 순위(확인 2점·약함 1점), 줄마다 확인된 술 먼저", () => {
    const g = guideContent(ds, findGuide(ds, "막걸리-안주")!);
    expect(g.foods[0]).toMatchObject({ item: { id: "전0" }, n: 2, confirmed: 2, score: 4 });
    expect(g.foods[0].with.map((w) => w.item.id)).toEqual(["막1", "막2"]);
    expect(g.foods[1]).toMatchObject({ item: { id: "전1" }, n: 2, score: 2 });
    expect(g.foods.some((f) => f.item.id === "전5" && f.n > 1)).toBe(false);
    expect(g.mix).toEqual([{ name: "전", n: 10 }, { name: "회", n: 1 }]);
  });
  it("음식 종류 화면 — 술 순위와 술 종류 비중", () => {
    const g = guideContent(ds, findGuide(ds, "전-어울리는-술")!, 15, 2);
    expect(g.drinks[0]).toMatchObject({ item: { id: "막1" }, n: 8 });
    expect(g.drinks[0].with).toHaveLength(2);
    expect(g.drinks[0].with[0]).toMatchObject({ item: { id: "전0" }, conf: "confirmed" });
    expect(g.mix).toEqual([{ name: "탁주", n: 10 }, { name: "약주", n: 1 }]);
  });
  it("실제 카탈로그 — 주소가 겹치지 않고 영문·한글·하이픈만", () => {
    const list = guideList(DATA);
    expect(list.length).toBeGreaterThan(8);
    expect(new Set(list.map((g) => g.slug)).size).toBe(list.length);
    for (const g of list) expect(g.slug).toMatch(/^[0-9A-Za-z가-힣-]+$/);
    expect(list.some((g) => g.slug === "막걸리-안주")).toBe(true);
  });
});
