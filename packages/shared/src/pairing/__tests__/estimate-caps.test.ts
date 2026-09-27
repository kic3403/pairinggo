import { describe, expect, it } from "vitest";
import { estimateCapPlan } from "../estimate-caps";

describe("추정 조합 상한(2026-09-27)", () => {
  it("음식마다 상위 N개, 술마다 상위 M개는 남기고 근거 조합·회원 평가 조합은 건드리지 않는다", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, d: `d${i}`, f: "cheese", estimate: true, pf: 90 - i })),   // 한 음식에 추정 6개
      { id: "ev", d: "d9", f: "cheese", estimate: false, pf: 10 },
      { id: "rated", d: "d8", f: "cheese", estimate: true, pf: 1, rated: true },
      { id: "only", d: "dz", f: "cheese", estimate: true, pf: 0 },   // 술의 유일한 조합 — 술마다 남김
    ];
    const hide = estimateCapPlan(rows, 2, 0);
    expect([...hide].sort()).toEqual(["e2", "e3", "e4", "e5", "only"]);
    const keepDrink = estimateCapPlan(rows, 2, 1);
    expect(keepDrink.has("only")).toBe(false);   // 술마다 1개는 남는다
    expect(keepDrink.has("e5")).toBe(false);      // d5의 유일한 추정 조합
    expect(keepDrink.has("ev")).toBe(false);
    expect(keepDrink.has("rated")).toBe(false);
  });
});
