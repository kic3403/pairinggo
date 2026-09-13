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
  it("실데이터: 검수된 양조장 공식 인용의 대부분이 찰떡, 맛 프로필 추정의 대부분은 찰떡이 아니다", () => {
    // es 90 = 라인업 확장 때 양조장 등록 정보(더술닷컴)에서 가져온 추천 음식 — 인용문 검수를 거친 공식 추천(91~97)보다 한 단계 아래라 대부분 '잘 어울림'
    const official = DATA.pairings.filter((p) => p.src === "official" && p.es >= 91);
    const registered = DATA.pairings.filter((p) => p.src === "official" && p.es === 90);
    expect(registered.filter((p) => pairingGrade(pairingScore(p)).key !== "try").length / registered.length).toBeGreaterThan(0.9);
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
  it("근거 링크 보너스 +3 — 링크가 있어야 붙는다", () => {
    const withEv = mk({ f: "e", ev: { source: "x", url: "https://example.com" } });
    const noEv = mk({ f: "n", ev: { source: "x", url: null } });
    const s = scorePairings([withEv, noEv]);
    expect(s[0].p.f).toBe("e");
    expect(s[0].base - s[1].base).toBe(3);
    expect(s[0].parts.ev).toBe(3);
    expect(explainOverall(s[0], "맛 프로필")).toContain("근거 +3");
  });
  it("같은 등급이면 점수가 낮아도 근거 조합이 맛 분석보다 앞 — 등급이 다르면 등급 순", () => {
    const strongProfile = mk({ f: "p", es: 86, blog: 300, pf: { s: 70, plus: [], minus: [] } });   // 종합 35 (시도해 볼 만)
    const weakEvidence = mk({ f: "e", es: 84, blog: 30, src: "blog", ev: { source: "x", url: "https://example.com" } });   // 종합 20 (시도해 볼 만)
    const s = scorePairings([strongProfile, weakEvidence]);
    expect(s.find((x) => x.p.f === "p")!.base).toBeGreaterThan(s.find((x) => x.p.f === "e")!.base);
    expect(s[0].grade.key).toBe(s[1].grade.key);
    expect(s[0].p.f).toBe("e");
    const best = mk({ f: "b", es: 97, blog: 9000, pf: { s: 95, plus: [], minus: [] } });
    expect(scorePairings([best, weakEvidence])[0].p.f).toBe("b");
  });
  it("실데이터: 어떤 음식 화면에서도 맛 분석이 같은 등급의 근거 조합 위에 오지 않는다 (2026-09-13 전엔 81곳 중 28곳)", () => {
    let bad = 0;
    for (const id of Object.keys(F)) {
      const s = scorePairings(byFood[id] || [], (p) => D[p.d].category);
      for (let i = 0; i < s.length; i++) if (!s[i].p.ev?.url) for (let j = i + 1; j < s.length; j++) if (s[j].p.ev?.url && s[j].grade.key === s[i].grade.key) { bad++; break; }
    }
    expect(bad).toBe(0);
  });
  it("툴팁 문구", () => {
    const s = scorePairings([mk({ src: "official", blog: 1445 })])[0];
    expect(explainOverall(s, "양조장 공식")).toContain("언급 1,445건");
    expect(explainOverall(s, "양조장 공식")).toContain("+4");
  });
});
