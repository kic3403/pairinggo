import { describe, expect, it } from "vitest";
import { DATA, D, F, byDrink, byFood, NON_TRAD, PRESIDENT, POPULAR, POPULAR_FOODS, CATEGORIES, BREWERIES, buyLink, drinksInRegion, todayPairing } from "../data";
import { choseong, toJamo, isChoseongOnly, decomposeChar } from "../hangul";
import { bayesianScore, haversineKm } from "../rating";
import { estimateRegion, REGIONS, RBY, subRegions, fullLabel } from "../regions";
import { similarDrinks, similarFoods, profileDistance } from "../similarity";

describe("데이터 무결성", () => {
  it("전통주 225 · 음식 143 · 페어링 2,184 (2026-09-13 라인업 확장 +99종·백경 +7·한증류소 +3, 2026-09-14 음식 확장 +33종, 2026-09-15 다농바이오 +3·신선주 +5)", () => {
    expect(DATA.drinks).toHaveLength(225);
    expect(DATA.foods).toHaveLength(143);
    expect(DATA.pairings).toHaveLength(2184);
  });
  it("모든 페어링이 존재하는 술·음식을 가리킨다", () => {
    for (const p of DATA.pairings) { expect(D[p.d], p.d).toBeDefined(); expect(F[p.f], p.f).toBeDefined(); }
  });
  it("술마다 페어링 5개 이상", () => {
    for (const d of DATA.drinks) expect((byDrink[d.id] || []).length, d.name).toBeGreaterThanOrEqual(5);
  });
  it("음식마다 페어링 1개 이상 (알려진 예외: 아귀찜 — 데이터 보강 대상)", () => {
    const KNOWN_EMPTY = new Set(["아귀찜"]);
    const empty = DATA.foods.filter((f) => !(byFood[f.id] || []).length).map((f) => f.name);
    expect(empty.filter((n) => !KNOWN_EMPTY.has(n))).toEqual([]);
  });
  it("온라인 판매 불가 7종이 데이터에 존재", () => {
    expect(NON_TRAD.size).toBe(7);
    for (const id of NON_TRAD) expect(D[id]).toBeDefined();
  });
  it("파생 목록", () => {
    expect(PRESIDENT.length).toBeGreaterThanOrEqual(5);
    expect(POPULAR).toHaveLength(10);
    expect(POPULAR_FOODS).toHaveLength(10);
    expect(CATEGORIES[0]).toEqual({ key: "탁주", count: 69 });
    expect(BREWERIES.length).toBeGreaterThan(50);
    const t = todayPairing(0); expect(D[t.d]).toBeDefined();
  });
  it("buyLink는 url이 있으면 공식 링크, 없으면 네이버쇼핑 폴백", () => {
    const withUrl = DATA.drinks.find((d) => d.buy.url)!;
    expect(buyLink(withUrl).fallback).toBe(false);
    const noUrl = { ...withUrl, buy: { url: null, store: null } };
    expect(buyLink(noUrl).store).toBe("네이버쇼핑");
  });
  it("drinksInRegion: 세부 지역에 술이 없으면 상위 접두어로 폴백", () => {
    const r = drinksInRegion(["서울 강남"], 12, ["서울"]);
    expect(r.list.length).toBeGreaterThan(0);
    expect(r.label).toBe("서울");
    const b = drinksInRegion(["부산"], 12);
    expect(b.label).toBeNull();
  });
});

describe("한글", () => {
  it("초성", () => {
    expect(choseong("복순도가")).toBe("ㅂㅅㄷㄱ");
    expect(choseong("한산소곡주 2병")).toBe("ㅎㅅㅅㄱㅈ 2ㅂ");
  });
  it("자모 분해 (겹받침 펼침)", () => {
    expect(decomposeChar("복")).toBe("ㅂㅗㄱ");
    expect(decomposeChar("닭")).toBe("ㄷㅏㄹㄱ");
    expect(toJamo("복순")).toBe("ㅂㅗㄱㅅㅜㄴ");
    expect(toJamo("ab 1")).toBe("ab 1");
  });
  it("초성만 판별", () => {
    expect(isChoseongOnly("ㅂㅅㄷㄱ")).toBe(true);
    expect(isChoseongOnly("복ㅅ")).toBe(false);
    expect(isChoseongOnly("")).toBe(false);
  });
});

describe("별점 보정", () => {
  it("리뷰 1개짜리 5.0은 리뷰 800개짜리 4.7을 이기지 못한다", () => {
    expect(bayesianScore(5, 1)).toBeLessThan(bayesianScore(4.7, 800));
  });
  it("거리", () => {
    expect(haversineKm(37.5665, 126.978, 35.1796, 129.0756)).toBeCloseTo(325, -1);
  });
});

describe("지역", () => {
  it("좌표 → 지역 추정", () => {
    expect(estimateRegion(33.5, 126.5)).toBe("jeju");
    expect(estimateRegion(35.18, 129.07)).toBe("busan");
    expect(estimateRegion(37.5563, 126.9236)).toBe("hongdae");
    expect(estimateRegion(37.5704, 126.9922)).toBe("jongno");
  });
  it("수도권 세부 지역과 라벨", () => {
    expect(subRegions("cap").length).toBeGreaterThan(10);
    expect(fullLabel(RBY.gangnam)).toBe("수도권 · 강남");
    expect(fullLabel(RBY.cap)).toContain("수도권 전체");
    expect(REGIONS.every((r) => RBY[r.id] === r)).toBe(true);
  });
});

describe("유사도", () => {
  it("프로필 거리", () => {
    expect(profileDistance({ sweet: 3, acid: 4, body: 3, fizz: 5, aroma: 3 }, { sweet: 3, acid: 4, body: 3, fizz: 5, aroma: 3 })).toBe(0);
    expect(profileDistance(undefined, { sweet: 1, acid: 1, body: 1, fizz: 1, aroma: 1 })).toBeNull();
  });
  it("비슷한 술은 같은 종류를 우선하고 자기 자신을 제외", () => {
    const d = D.d01;
    const sim = similarDrinks(d, 5);
    expect(sim.length).toBeGreaterThan(0);
    expect(sim.every((o) => o.x.id !== d.id)).toBe(true);
    expect(sim[0].x.category).toBe(d.category);
  });
  it("비슷한 음식", () => {
    const f = F.f01;
    const sim = similarFoods(f, 4);
    expect(sim.every((o) => o.x.id !== f.id)).toBe(true);
  });
});
