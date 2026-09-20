import { describe, expect, it } from "vitest";
import { search, suggest, editDistance } from "../match";
import { normalize, stripSuffix, categoryOf, findCategory } from "../normalize";
import { DOCS } from "../docs";
import { D } from "../../data";

const top = (q: string) => search(q).hits[0]?.doc;
const names = (q: string, n = 5) => search(q).hits.slice(0, n).map((h) => h.doc.name);

describe("정규화", () => {
  it("공백·기호·대소문자·전각", () => {
    expect(normalize("복순도가 손막걸리")).toBe("복순도가손막걸리");
    expect(normalize("Ｈan산 소곡주!")).toBe("han산소곡주");
    expect(normalize("  한산-소곡주 ")).toBe("한산소곡주");
  });
  it("접미어 제거", () => {
    expect(stripSuffix("복순도가술")).toBe("복순도가");
    expect(stripSuffix("육회안주")).toBe("육회");
    expect(stripSuffix("술")).toBe("술");
  });
  it("종류 동의어", () => {
    expect(categoryOf("막걸리")).toBe("탁주");
    expect(categoryOf("와인")).toBe("과실주");
    expect(findCategory("도수낮은막걸리")?.category).toBe("탁주");
  });
});

describe("편집거리", () => {
  it("기본", () => {
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("abc", "abd")).toBe(1);
    expect(editDistance("abc", "xyz", 2)).toBe(3);
  });
});

describe("이름 검색", () => {
  it("정확 일치가 1위", () => {
    expect(top("복순도가 손막걸리")?.id).toBe("d01");
    expect(top("육회")?.id).toBe("f01");
  });
  it("띄어쓰기 무시", () => {
    expect(top("복순도가손막걸리")?.id).toBe("d01");
    expect(top("복순 도가")?.id).toBe("d01");
  });
  it("별칭", () => {
    expect(top("복순도가")?.id).toBe("d01");
  });
  it("조합 중 입력 (자모 접두)", () => {
    expect(top("복순ㄷ")?.id).toBe("d01");
  });
  it("초성", () => {
    expect(names("ㅂㅅㄷㄱ")).toContain("복순도가 손막걸리");
    expect(top("ㅇㅎ")?.type).toBeDefined();
  });
  it("오타 허용", () => {
    expect(top("복손도가")?.id).toBe("d01");
    const r = search("한산소국주");
    expect(r.hits.some((h) => h.doc.name.includes("한산소곡주"))).toBe(true);
  });
  it("양조장 이름으로 술 찾기", () => {
    const brewery = D.d01.brewery;
    const r = search(brewery);
    expect(r.drinks.some((h) => h.doc.id === "d01")).toBe(true);
  });
  it("종류 동의어 → 둘러보기 항목 + 그 종류 술", () => {
    const r = search("막걸리");
    expect(r.browse[0]?.doc.key).toBe("탁주");
    expect(r.drinks.length).toBeGreaterThan(5);
    expect(r.drinks.every((h) => D[h.doc.id].category === "탁주")).toBe(true);
  });
  it("지역으로 술 찾기", () => {
    const r = search("울주");
    expect(r.drinks.some((h) => D[h.doc.id].region.includes("울주"))).toBe(true);
    expect(r.browse.some((h) => h.doc.kind === "region")).toBe(true);
  });
  it("맛 태그 검색", () => {
    const r = search("탄산");
    expect(r.drinks.length).toBeGreaterThan(0);
  });
  it("여러 단어 AND 매칭", () => {
    expect(top("복순도가 막걸리")?.id).toBe("d01");
    expect(top("울주 탁주")?.id).toBe("d01");
    const r = search("제주 증류주");
    expect(r.drinks.length).toBeGreaterThan(0);
    expect(r.drinks.every((h) => D[h.doc.id].region.includes("제주") && D[h.doc.id].category === "증류주")).toBe(true);
  });
  it("접미어 붙은 검색어", () => {
    expect(top("복순도가 술")?.id).toBe("d01");
    expect(top("육회 안주")?.id).toBe("f01");
  });
  it("결과 없음 → 제안", () => {
    const r = search("없는이름xyz");
    expect(r.hits).toHaveLength(0);
    const s = suggest("복순두가");
    expect(s[0]?.id).toBe("d01");
  });
  it("빈 검색어", () => {
    expect(search("").hits).toHaveLength(0);
    expect(search("   ").hits).toHaveLength(0);
  });
  it("타입 제한", () => {
    const r = search("육회", { types: ["drink"] });
    expect(r.foods).toHaveLength(0);
  });
  it("인덱스 크기", () => {
    expect(DOCS.filter((d) => d.type === "drink")).toHaveLength(518);
    expect(DOCS.filter((d) => d.type === "food")).toHaveLength(143);
    expect(DOCS.filter((d) => d.kind === "category")).toHaveLength(8);
    expect(DOCS.filter((d) => d.kind === "brewery").length).toBeGreaterThan(50);
  });
});
