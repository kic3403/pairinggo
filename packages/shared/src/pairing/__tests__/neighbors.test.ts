import { describe, expect, it } from "vitest";
import type { Drink, Food, Pairing } from "../../types";
import { evidenceNeighbors } from "../neighbors";

const drink = (id: string) => ({ id, name: id }) as Drink;
const food = (id: string) => ({ id, name: id }) as Food;
const pair = (d: string, f: string, evs: number): Pairing => ({ d, f, es: 0, reason: "", blog: 0, src: evs ? "media" : "profile", evs, evn: evs ? 1 : 0 }) as Pairing;

describe("근거 없는 술의 이웃", () => {
  const P: Record<string, Pairing[]> = {
    a: [pair("a", "f1", 0.6), pair("a", "f2", 1.6), pair("a", "f3", 0)],
    b: [pair("b", "f1", 0)],
    c: [pair("c", "fx", 1), pair("c", "f4", 1.2)],
  };
  const foods: Record<string, Food> = { f1: food("f1"), f2: food("f2"), f3: food("f3"), f4: food("f4") };
  it("근거 있는 술만, 확인 → 강도 순, 없는 음식은 건너뜀", () => {
    const r = evidenceNeighbors([{ drink: drink("a"), rel: "brewery" }, { drink: drink("b"), rel: "brewery" }, { drink: drink("c"), rel: "similar", why: ["같은 종류"] }], (id) => P[id], (id) => foods[id]);
    expect(r.map((x) => x.drink.id)).toEqual(["a", "c"]);
    expect(r[0].foods).toEqual([{ food: foods.f2, conf: "confirmed" }, { food: foods.f1, conf: "weak" }]);
    expect(r[1]).toMatchObject({ rel: "similar", why: ["같은 종류"], foods: [{ food: foods.f4, conf: "confirmed" }] });
  });
  it("개수 제한·중복 술", () => {
    const r = evidenceNeighbors([{ drink: drink("a"), rel: "brewery" }, { drink: drink("a"), rel: "similar" }, { drink: drink("c"), rel: "similar" }], (id) => P[id], (id) => foods[id], 1, 1);
    expect(r).toHaveLength(1);
    expect(r[0].foods).toHaveLength(1);
  });
});

describe("근거 없는 음식의 이웃", async () => {
  const { foodEvidenceNeighbors } = await import("../neighbors");
  const P: Record<string, Pairing[]> = { f1: [pair("d1", "f1", 0.3), pair("d2", "f1", 1), pair("d3", "f1", 0)], f2: [pair("d1", "f2", 0)], f3: [pair("dx", "f3", 1)] };
  const drinks: Record<string, Drink> = { d1: drink("d1"), d2: drink("d2"), d3: drink("d3") };
  it("근거 있는 음식만, 확인 먼저, 없는 술은 건너뜀", () => {
    const r = foodEvidenceNeighbors([{ food: food("f1"), why: ["전"] }, { food: food("f2") }, { food: food("f3") }], (id) => P[id], (id) => drinks[id]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ why: ["전"], drinks: [{ drink: drinks.d2, conf: "confirmed" }, { drink: drinks.d1, conf: "weak" }] });
  });
});
