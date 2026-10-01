import { describe, expect, it } from "vitest";
import type { Drink, Food, Pairing } from "../types";
import { DATA } from "../data";
import { guideBlogDraft } from "../seo/blog-draft";
import { findGuide, guideContent, guideList, guideRegionOf } from "../seo/guides";

const drink = (id: string, category: string, region = ""): Drink => ({ id, name: id, category, region }) as Drink;
const food = (id: string, category: string, tags: string[] = []): Food => ({ id, name: id, category, tags }) as Food;
const pair = (d: string, f: string, evs: number, src = "media", reason = ""): Pairing => ({ d, f, es: 0, reason, blog: 0, src: evs ? src : "profile", evs, evn: evs ? 1 : 0, ev: { quote: "남의 글 인용문은 싣지 않는다" } }) as Pairing;

describe("모음 — 지역별·맛별", () => {
  const drinks = [drink("막1", "탁주", "충남 서천"), drink("막2", "탁주", "충남 당진"), drink("약1", "약주", "경기 포천")];
  const foods = [...Array.from({ length: 8 }, (_, i) => food(`찌개${i}`, "한식", ["매콤", "얼큰"])), food("전0", "전", ["기름진"])];
  const pairings = [
    ...Array.from({ length: 8 }, (_, i) => pair("막1", `찌개${i}`, i === 0 ? 1.6 : 0.6, i === 0 ? "official" : "blog", i === 0 ? "칼칼한 국물을 막걸리의 단맛이 눌러 줍니다. 바디 3점 ↔ 무게 4점 균형." : "")),
    pair("막2", "찌개0", 1, "media", "매체가 소개한 조합입니다."), pair("막2", "찌개1", 0.3), pair("막2", "전0", 1),
    pair("약1", "찌개0", 1), pair("약1", "찌개2", 0),
  ];
  const ds = { drinks, foods, pairings };

  it("지역 — region의 첫 낱말로 묶는다", () => {
    expect(guideRegionOf(drinks[0])).toBe("충남");
    expect(guideRegionOf({ region: "" })).toBe("");
    const g = findGuide(ds, "충남-전통주-안주")!;
    expect(g).toMatchObject({ side: "drink", by: "region", category: "충남", word: "충남 전통주", n: 11, h1: "충남 전통주 안주 추천" });
    const c = guideContent(ds, g);
    expect(c.foods[0]).toMatchObject({ item: { id: "찌개0" }, n: 2, confirmed: 2 });
    expect(c.foods[0].with.map((w) => w.item.id)).toEqual(["막1", "막2"]);       // 경기 술(약1)은 안 들어감
    expect(c.foods[0].with[0]).toMatchObject({ conf: "confirmed", src: "양조장 추천" });
    expect(findGuide(ds, "경기-전통주-안주")).toBeUndefined();                     // 근거 조합 1개 — 화면 없음
  });
  it("맛 — 정해 둔 태그만, 음식 태그로 묶는다", () => {
    const g = findGuide(ds, "매운음식-어울리는-술")!;
    expect(g).toMatchObject({ side: "food", by: "tag", category: "매콤", word: "매운 음식", h1: "매운 음식에 어울리는 술", n: 11 });
    expect(guideContent(ds, g).drinks[0]).toMatchObject({ item: { id: "막1" }, n: 8 });
    expect(guideList(ds).some((x) => x.by === "tag" && x.category === "얼큰")).toBe(false);   // 표에 없는 태그
    expect(guideList(ds).some((x) => x.slug === "기름진음식-어울리는-술")).toBe(false);      // 1개뿐
  });
  it("차례 — 술 종류 → 지역 → 음식 종류 → 맛", () => {
    expect(guideList(ds).map((g) => `${g.side}|${g.by}`)).toEqual(["drink|category", "drink|region", "food|category", "food|tag"]);
  });
  it("실제 카탈로그 — 지역·맛 화면이 생기고 주소가 겹치지 않는다", () => {
    const list = guideList(DATA);
    expect(new Set(list.map((g) => g.slug)).size).toBe(list.length);
    expect(list.some((g) => g.slug === "충남-전통주-안주")).toBe(true);
    expect(list.some((g) => g.slug === "매운음식-어울리는-술")).toBe(true);
    expect(list.filter((g) => g.by === "category").length).toBeGreaterThanOrEqual(17);
    for (const g of list) { expect(g.slug).toMatch(/^[0-9A-Za-z가-힣-]+$/); expect(g.n).toBeGreaterThanOrEqual(10); }
  });
});

describe("블로그 글 초안", () => {
  const drinks = [drink("막1", "탁주", "충남 서천"), drink("막2", "탁주", "충남 당진")];
  const foods = Array.from({ length: 8 }, (_, i) => food(`전${i}`, "전"));
  const pairings = [...Array.from({ length: 8 }, (_, i) => pair("막1", `전${i}`, i === 0 ? 1.6 : 0.6, i === 0 ? "official" : "blog", i === 0 ? "기름진 전을 막걸리의 산미가 씻어 줍니다. 바디 3점 ↔ 무게 4점." : "")), pair("막2", "전0", 1), pair("막2", "전1", 1)];
  const ds = { drinks, foods, pairings };

  it("술 쪽 — 제목·번호 줄·근거 표시·주소", () => {
    const d = guideBlogDraft(guideContent(ds, findGuide(ds, "막걸리-안주")!), "https://pairinggo.kr", 3);
    expect(d.title).toBe("막걸리 안주 추천 3가지 — 근거로 골랐어요");
    expect(d.body).toContain("1. 전0");
    expect(d.body).toContain("어울리는 막걸리: 막1, 막2");
    expect(d.body).toContain("기름진 전을 막걸리의 산미가 씻어 줍니다.");
    expect(d.body).not.toContain("바디 3점");                          // 첫 문장만
    expect(d.body).toContain("(근거 확인 · 양조장 추천 · 근거 조합 2개)");
    expect(d.body).toContain("https://pairinggo.kr/guide/막걸리-안주?utm_source=blog");
    expect(d.body).toContain("#페어링고");
    expect(d.body).toContain("만 19세");
    expect(d.body).not.toContain("4. ");
  });
  it("틀 문장은 싣지 않고 다음 짝의 설명을 쓴다", () => {
    const ps = [...Array.from({ length: 8 }, (_, i) => pair("막1", `전${i}`, 1.6, "media", i === 0 ? "전0와(과) 함께 즐긴 후기·추천이 있는 조합 — 매체 근거" : "")), pair("막2", "전0", 1, "official", "양조장이 직접 권한 조합입니다."), pair("막2", "전1", 1)];
    const d2 = { drinks, foods, pairings: ps };
    const d = guideBlogDraft(guideContent(d2, findGuide(d2, "막걸리-안주")!), "u", 1);
    expect(d.body).not.toContain("와(과)");
    expect(d.body).toContain("양조장이 직접 권한 조합입니다.");
  });
  it("남의 글 인용문은 싣지 않는다", () => {
    const d = guideBlogDraft(guideContent(ds, findGuide(ds, "막걸리-안주")!), "https://pairinggo.kr");
    expect(d.body).not.toContain("남의 글 인용문");
  });
  it("음식 쪽 — 술 순위", () => {
    const d = guideBlogDraft(guideContent(ds, findGuide(ds, "전-어울리는-술")!), "u", 2);
    expect(d.title).toBe("전에 어울리는 술 2가지 — 근거로 골랐어요");
    expect(d.body).toContain("1. 막1");
    expect(d.body).toContain("어울리는 전: 전0,");
  });
  it("실제 카탈로그 — 모음마다 글이 나온다", () => {
    for (const g of guideList(DATA)) {
      const d = guideBlogDraft(guideContent(DATA, g), "https://pairinggo.kr");
      expect(d.title.length).toBeGreaterThan(8);
      expect(d.body).toContain("1. ");
      expect(d.body).toContain(`/guide/${g.slug}?utm_source=blog`);
    }
  });
});
