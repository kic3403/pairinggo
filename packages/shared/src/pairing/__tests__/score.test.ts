import { describe, expect, it } from "vitest";
import { scorePairings, sortByTab, explainOverall, blogPart, pairingScore, pairingGrade, GRADE_CUT } from "../score";
import { DATA, byDrink, byFood, D, F } from "../../data";
import type { Pairing } from "../../types";

const mk = (over: Partial<Pairing>): Pairing => ({ d: "d01", f: "f01", es: 90, reason: "", blog: 100, src: "profile", pf: { s: 50, plus: [], minus: [] }, ...over });
const REF = Math.log1p(10000);

describe("대중 언급 — 모든 조합에 같은 자 (2026-09-13)", () => {
  it("로그 눈금: 0건은 0, 기준 이상은 100으로 잘림, 사이는 로그 비율", () => {
    expect(blogPart(0, REF)).toBe(0);
    expect(blogPart(10000, REF)).toBe(1);
    expect(blogPart(50000, REF)).toBe(1);
    expect(blogPart(100, REF)).toBeCloseTo(Math.log1p(100) / REF, 6);
    expect(blogPart(undefined, REF)).toBe(0);
  });
  it("같은 조합은 함께 놓인 조합과 무관하게 같은 점수 — 예전엔 그 술에서 꼴찌면 0이었다", () => {
    const target = mk({ f: "gal", es: 84, blog: 2032, pf: { s: 33, plus: [], minus: [] } });
    const alone = scorePairings([target], undefined, { blogRef: REF })[0];
    const amongBigger = scorePairings([mk({ f: "x", blog: 8976 }), mk({ f: "y", blog: 3064 }), target], undefined, { blogRef: REF }).find((s) => s.p.f === "gal")!;
    expect(amongBigger.parts.blog).toBe(alone.parts.blog);
    expect(amongBigger.parts.blog).toBeGreaterThan(0);
    expect(amongBigger.base).toBe(alone.base);
    expect(alone.base).toBe(pairingScore(target, { blogRef: REF }));
  });
  it("실데이터: 모든 조합이 술 화면과 음식 화면에서 기본 점수·등급이 같다", () => {
    const fromDrink = new Map<string, { base: number; grade: string }>();
    for (const id of Object.keys(D)) for (const s of scorePairings(byDrink[id] || [], (p) => F[p.f].category)) fromDrink.set(`${s.p.d}|${s.p.f}`, { base: s.base, grade: s.grade.key });
    let n = 0;
    for (const id of Object.keys(F)) for (const s of scorePairings(byFood[id] || [], (p) => D[p.d].category)) {
      expect(fromDrink.get(`${s.p.d}|${s.p.f}`)).toEqual({ base: s.base, grade: s.grade.key }); n++;
    }
    expect(n).toBe(DATA.pairings.length);
  });
});

describe("등급 표시 — 숫자 대신 찰떡·잘 어울림·시도해 볼 만", () => {
  it("경계", () => {
    expect(pairingGrade(GRADE_CUT.best).label).toBe("찰떡");
    expect(pairingGrade(GRADE_CUT.best - 1).label).toBe("잘 어울림");
    expect(pairingGrade(GRADE_CUT.good).label).toBe("잘 어울림");
    expect(pairingGrade(GRADE_CUT.good - 1).label).toBe("시도해 볼 만");
    expect(pairingGrade(0).key).toBe("try");
    expect(pairingGrade(100).key).toBe("best");
  });
  it("등급은 편중 보정(−5) 전 점수로 매긴다 — 순위만 바뀌고 등급은 안 바뀐다", () => {
    const rows = [mk({ f: "a1", es: 96, blog: 5000 }), mk({ f: "a2", es: 96, blog: 5000 }), mk({ f: "a3", es: 96, blog: 5000 })];
    const s = scorePairings(rows, (p) => p.f[0], { blogRef: REF });
    const adj = s.find((x) => x.adjusted)!;
    expect(adj.overall).toBe(adj.base - 5);
    expect(adj.grade.key).toBe(pairingGrade(adj.base).key);
  });
  it("실데이터: 양조장 공식 추천의 대부분이 찰떡, 맛 프로필 추정의 대부분은 찰떡이 아니다", () => {
    const official = DATA.pairings.filter((p) => p.src === "official");
    const profile = DATA.pairings.filter((p) => p.src === "profile");
    expect(official.filter((p) => pairingGrade(pairingScore(p)).key === "best").length / official.length).toBeGreaterThan(0.6);
    expect(profile.filter((p) => pairingGrade(pairingScore(p)).key === "best").length / profile.length).toBeLessThan(0.05);
  });
});

describe("종합 점수", () => {
  it("가중 합과 범위", () => {
    const rows = [mk({ f: "a", es: 97, blog: 10000, pf: { s: 100, plus: [], minus: [] }, src: "official" }), mk({ f: "b", es: 84, blog: 0, pf: { s: 0, plus: [], minus: [] } })];
    const s = scorePairings(rows, undefined, { blogRef: REF });
    expect(s[0].p.f).toBe("a");
    expect(s[0].overall).toBe(100); // 60+25+15 = 100, +4는 상한에서 잘림
    expect(s[1].overall).toBe(0);
    expect(s[0].parts).toMatchObject({ es: 100, blog: 100, pf: 100, tier: 4 });
  });
  it("전문가 점수 비중이 가장 크다", () => {
    const rows = [mk({ f: "hiEs", es: 97, blog: 10 }), mk({ f: "hiBlog", es: 84, blog: 100000 })];
    const s = scorePairings(rows);
    expect(s[0].p.f).toBe("hiEs");
  });
  it("출처 등급 보너스", () => {
    const rows = [mk({ f: "o", src: "official" }), mk({ f: "s", src: "sommelier" }), mk({ f: "m", src: "media" }), mk({ f: "p", src: "profile" })];
    const s = scorePairings(rows);
    expect(s.map((x) => x.p.f)).toEqual(["o", "s", "m", "p"]);
    expect(s[0].overall - s[3].overall).toBe(4);
  });
  it("편중 보정: 상위 5에 같은 그룹 3개면 3번째부터 −5", () => {
    const rows = [
      mk({ f: "a1", es: 96, blog: 100 }), mk({ f: "a2", es: 95, blog: 100 }), mk({ f: "a3", es: 94, blog: 100 }),
      mk({ f: "b1", es: 93, blog: 100 }), mk({ f: "a4", es: 92, blog: 100 }),
    ];
    const s = scorePairings(rows, (p) => p.f[0]);
    const a3 = s.find((x) => x.p.f === "a3")!;
    expect(a3.adjusted).toBe(true);
    expect(s.find((x) => x.p.f === "a1")!.adjusted).toBe(false);
    expect(s.find((x) => x.p.f === "b1")!.adjusted).toBe(false);
  });
  it("동점은 전문가 점수 → 언급량 순", () => {
    const rows = [mk({ f: "x", es: 90, blog: 100 }), mk({ f: "y", es: 90, blog: 100 })];
    const s = scorePairings(rows);
    expect(s).toHaveLength(2);
    expect(s[0].overall).toBe(s[1].overall);
  });
  it("탭 정렬", () => {
    const rows = [mk({ f: "e", es: 97, blog: 1 }), mk({ f: "b", es: 84, blog: 9999 })];
    const s = scorePairings(rows);
    expect(sortByTab(s, "expert")[0].p.f).toBe("e");
    expect(sortByTab(s, "public")[0].p.f).toBe("b");
  });
  it("실데이터: 술·음식 상세의 페어링 전부 0~100", () => {
    for (const id of Object.keys(D)) for (const s of scorePairings(byDrink[id] || [], (p) => F[p.f].category)) { expect(s.overall).toBeGreaterThanOrEqual(0); expect(s.overall).toBeLessThanOrEqual(100); }
    for (const id of Object.keys(F)) for (const s of scorePairings(byFood[id] || [], (p) => D[p.d].category)) { expect(s.overall).toBeGreaterThanOrEqual(0); expect(s.overall).toBeLessThanOrEqual(100); }
  });
  it("툴팁 문구", () => {
    const s = scorePairings([mk({ src: "official", blog: 1445 })])[0];
    expect(explainOverall(s, "양조장 공식")).toContain("언급 1,445건");
    expect(explainOverall(s, "양조장 공식")).toContain("+4");
  });
});
