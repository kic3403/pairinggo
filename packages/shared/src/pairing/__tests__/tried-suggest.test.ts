import { describe, expect, it } from "vitest";
import { suggestTried } from "../tried-suggest";
import type { Pairing } from "../../types";

const P = (d: string, f: string, es = 90): Pairing => ({ d, f, es, reason: "", blog: 0 });
const byDrink = { d1: [P("d1", "f1", 95), P("d1", "f2", 90), P("d1", "f3", 85)], d2: [P("d2", "f9", 92)] };
const byFood = { f1: [P("d1", "f1", 95), P("d5", "f1", 88)], f7: [P("d7", "f7", 84)] };
const rank = (rows: Pairing[]) => [...rows].sort((a, b) => b.es - a.es);

describe("먹어봤나요? 추천 조합", () => {
  it("저장한 술·음식을 번갈아 최상위 조합을 뽑고, 최대 3개", () => {
    const got = suggestTried({ savedDrinks: ["d1", "d2"], savedFoods: ["f7"], rated: new Set(), byDrink, byFood, rank });
    expect(got).toEqual([{ d: "d1", f: "f1" }, { d: "d7", f: "f7" }, { d: "d2", f: "f9" }]);
  });
  it("이미 평가한 조합과 중복 조합은 건너뛴다", () => {
    const got = suggestTried({ savedDrinks: ["d1"], savedFoods: ["f1"], rated: new Set(["d1|f1"]), byDrink, byFood, rank });
    expect(got).toEqual([{ d: "d1", f: "f2" }, { d: "d5", f: "f1" }, { d: "d1", f: "f3" }]);
  });
  it("저장한 것이 없거나 모두 평가했으면 빈 목록", () => {
    expect(suggestTried({ savedDrinks: [], savedFoods: [], rated: new Set(), byDrink, byFood, rank })).toEqual([]);
    expect(suggestTried({ savedDrinks: ["d2"], savedFoods: [], rated: new Set(["d2|f9"]), byDrink, byFood, rank })).toEqual([]);
  });
});
