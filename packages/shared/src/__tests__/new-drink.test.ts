import { describe, expect, it } from "vitest";
import { buySearchLinks, categoryAverageProfile, cleanNewDrink, isSmartstoreUrl, pageShowsDrink } from "../catalog/new-drink";
import { cleanAttrs } from "../catalog/kinds";
import { profileAxes, profileLine, profileUnknown } from "../pairing/summary";
import { profileFit } from "../lineup/lineup";

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
  it("맛 프로필 '모름' — 평균으로 채우고 모르는 축을 적어 둔다", () => {
    const avg = { sweet: 2, acid: 4, body: 3, fizz: 5, aroma: 1 };
    const r = cleanNewDrink({ ...ok, profile: { sweet: 4, acid: "", body: 3, fizz: null, aroma: "모름" } }, avg);
    expect(r.ok && r.value.profile).toEqual({ sweet: 4, acid: 4, body: 3, fizz: 5, aroma: 1 });
    expect(r.ok && r.value.profileUnknown).toEqual(["acid", "fizz", "aroma"]);
    expect(cleanNewDrink(ok).ok && (cleanNewDrink(ok) as { value: { profileUnknown: string[] } }).value.profileUnknown).toEqual([]);
  });
  it("모르는 축 표시 — 막대는 '모름', 전부 모르면 숨김, attrs에 남는다", () => {
    const p = { sweet: 4, acid: 3, body: 3, fizz: 5, aroma: 2 };
    const attrs = { profile_unknown: ["fizz", "x"] };
    expect(profileUnknown(attrs)).toEqual(["fizz"]);
    expect(profileAxes("drink", p, ["fizz"]).find((a) => a.key === "fizz")).toMatchObject({ unknown: true, value: 0 });
    expect(profileAxes("drink", p, ["sweet", "acid", "body", "fizz", "aroma"])).toEqual([]);
    expect(profileLine("drink", p, ["fizz"])).toContain("탄산 모름");
    expect(cleanAttrs("trad", { profile_unknown: ["fizz", "fizz", "zzz"] })).toEqual({ profile_unknown: ["fizz"] });
  });
  it("모르는 축으로 맛 분석 이유를 짓지 않는다", () => {
    const d = { sweet: 3, acid: 4, body: 2, fizz: 4, aroma: 2 }, f = { fat: 4, spice: 1, umami: 2, salt: 2, sweet: 2, weight: 2 };
    expect(profileFit(d, 6, f).plus.join()).toContain("탄산");
    const u = profileFit(d, 6, f, ["fizz", "aroma"]);
    expect(u.plus.concat(u.minus).join()).not.toMatch(/탄산|향/);
    expect(profileFit(d, 6, f, ["sweet", "acid", "body", "fizz", "aroma"])).toMatchObject({ plus: [], minus: [] });
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
