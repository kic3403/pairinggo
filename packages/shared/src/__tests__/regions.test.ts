import { describe, expect, it } from "vitest";
import { drinkInRegion, regionById, TOP_REGIONS } from "../regions";

describe("지역 필터", () => {
  it("regionById — all·모르는 id는 전국(null)", () => {
    expect(regionById("all")).toBeNull();
    expect(regionById("nope")).toBeNull();
    expect(regionById(undefined)).toBeNull();
    expect(regionById("busan")?.label).toBe("부산");
  });
  it("drinkInRegion — 접두어 일치, 전국은 모두", () => {
    const busan = regionById("busan"), cap = regionById("cap"), cc = regionById("cc");
    expect(drinkInRegion({ region: "부산 금정" }, busan)).toBe(true);
    expect(drinkInRegion({ region: "울산 울주" }, busan)).toBe(false);
    expect(drinkInRegion({ region: "경기 양평" }, cap)).toBe(true);
    expect(drinkInRegion({ region: "충북 청주" }, cc)).toBe(true);
    expect(drinkInRegion({ region: "" }, busan)).toBe(false);
    expect(drinkInRegion({ region: "" }, null)).toBe(true);
  });
  it("상위 지역 목록에 전국이 맨 앞", () => {
    expect(TOP_REGIONS[0].id).toBe("all");
    expect(TOP_REGIONS.every((r) => !r.parent)).toBe(true);
  });
});
