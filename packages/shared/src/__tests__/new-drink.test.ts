import { describe, expect, it } from "vitest";
import { buySearchLinks, categoryAverageProfile, cleanNewDrink, isSmartstoreUrl, pageShowsDrink } from "../catalog/new-drink";

describe("어드민 새 술 등록", () => {
  const ok = { name: "메들리손막걸리", category: "탁주", abv: "6", brewery: "메들리양조", region: "경기 파주", desc: "", buyUrl: "", buyStore: "", profile: { sweet: 4, acid: 2, body: 3, fizz: 2, aroma: 3 } };
  it("검사 — 이름·종류·도수·판매처", () => {
    const r = cleanNewDrink(ok);
    expect(r.ok && r.value).toMatchObject({ name: "메들리손막걸리", abv: 6, buyUrl: null, buyStore: null });
    expect(cleanNewDrink({ ...ok, name: "막" })).toMatchObject({ ok: false });
    expect(cleanNewDrink({ ...ok, category: "맥주" })).toMatchObject({ ok: false, problem: "종류를 골라 주세요" });
    expect(cleanNewDrink({ ...ok, abv: "" })).toMatchObject({ ok: true, value: { abv: null } });
    expect(cleanNewDrink({ ...ok, abv: "120" })).toMatchObject({ ok: false });
    expect(cleanNewDrink({ ...ok, buyUrl: "http://x.com" })).toMatchObject({ ok: false });
    expect(cleanNewDrink({ ...ok, buyUrl: "https://abc.modoo.at/" })).toMatchObject({ ok: false });
    expect(cleanNewDrink({ ...ok, buyUrl: "https://smartstore.naver.com/abc/products/1" })).toMatchObject({ ok: true, value: { buyStore: "스마트스토어" } });
    expect(cleanNewDrink({ ...ok, profile: { sweet: 9, acid: 0 } })).toMatchObject({ ok: true, value: { profile: { sweet: 5, acid: 3, body: 3 } } });
  });
  it("종류 평균 맛 프로필", () => {
    const drinks = [{ category: "탁주", profile: { sweet: 4, acid: 2, body: 3, fizz: 1, aroma: 3 } }, { category: "탁주", profile: { sweet: 2, acid: 4, body: 3, fizz: 3, aroma: 3 } }, { category: "약주", profile: { sweet: 1, acid: 1, body: 1, fizz: 1, aroma: 1 } }];
    expect(categoryAverageProfile(drinks, "탁주")).toEqual({ sweet: 3, acid: 3, body: 3, fizz: 2, aroma: 3 });
    expect(categoryAverageProfile(drinks, "청주")).toEqual({ sweet: 3, acid: 3, body: 3, fizz: 3, aroma: 3 });
  });
  it("판매처 페이지 확인·스마트스토어·찾아보기", () => {
    expect(pageShowsDrink("<h1>메들리 손 막걸리 750ml</h1>", ["메들리손막걸리"])).toBe(true);
    expect(pageShowsDrink("<h1>다른 막걸리</h1>", ["메들리손막걸리"])).toBe(false);
    expect(isSmartstoreUrl("https://smartstore.naver.com/x")).toBe(true);
    expect(isSmartstoreUrl("https://medley.co.kr")).toBe(false);
    expect(buySearchLinks("금과명주").map((l) => l.label)).toContain("요즘이술");
  });
});
