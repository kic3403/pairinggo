import { describe, expect, it } from "vitest";
import { scorePairings, sortByTab, explainOverall } from "../score";
import { byDrink, byFood, D, F } from "../../data";
import type { Pairing } from "../../types";

const mk = (over: Partial<Pairing>): Pairing => ({ d: "d01", f: "f01", es: 90, reason: "", blog: 100, src: "profile", pf: { s: 50, plus: [], minus: [] }, ...over });

describe("종합 점수", () => {
  it("가중 합과 범위", () => {
    const rows = [mk({ f: "a", es: 97, blog: 10000, pf: { s: 100, plus: [], minus: [] }, src: "official" }), mk({ f: "b", es: 84, blog: 0, pf: { s: 0, plus: [], minus: [] } })];
    const s = scorePairings(rows);
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
