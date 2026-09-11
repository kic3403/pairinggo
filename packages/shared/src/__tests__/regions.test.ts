import { describe, expect, it } from "vitest";
import { drinkInRegion, regionById, REGION_TREE, TOP_REGIONS, topOf } from "../regions";

describe("지역 트리", () => {
  it("수도권 하위는 서울·인천·경기도 셋이고 모두 실제 지역이다", () => {
    expect(REGION_TREE.cap.map((s) => s.label)).toEqual(["서울", "인천", "경기도"]);
    for (const s of REGION_TREE.cap) expect(regionById(s.id)?.parent).toBe("cap");
    expect(drinkInRegion({ region: "경기 양평" }, regionById("gg"))).toBe(true);
    expect(drinkInRegion({ region: "서울 강남" }, regionById("gg"))).toBe(false);
    expect(drinkInRegion({ region: "인천 강화" }, regionById("incheon"))).toBe(true);
  });
  it("topOf — 세부 지역이면 부모, 상위면 자기 자신, 전국은 all", () => {
    expect(topOf(regionById("seoul"))).toBe("cap");
    expect(topOf(regionById("busan"))).toBe("busan");
    expect(topOf(null)).toBe("all");
  });
});

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
