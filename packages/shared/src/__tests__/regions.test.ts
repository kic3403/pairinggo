import { describe, expect, it } from "vitest";
import { childrenOf, drinkInRegion, estimateRegion, level2Of, regionById, REGION_TREE, TOP_REGIONS, topOf } from "../regions";

describe("수도권 3단계 — 수도권 › 서울 › 강남", () => {
  it("level2Of — 세부 지역은 접두어로 서울·경기도·인천에 붙는다", () => {
    expect(level2Of(regionById("gangnam"))?.id).toBe("seoul");
    expect(level2Of(regionById("ggn"))?.id).toBe("gg");
    expect(level2Of(regionById("suwon"))?.id).toBe("gg");
    expect(level2Of(regionById("incheon"))?.id).toBe("incheon");
    expect(level2Of(regionById("seoul"))?.id).toBe("seoul");
    expect(level2Of(regionById("busan"))).toBeNull();
    expect(level2Of(null)).toBeNull();
  });
  it("childrenOf — 서울 11개 세부, 경기도 6개, 인천 0", () => {
    expect(childrenOf(regionById("seoul")).map((r) => r.id)).toEqual(["gangnam", "seocho", "jamsil", "ydp", "seongsu", "jongno", "hongdae", "yongsan", "seongbuk", "guro"]);
    expect(childrenOf(regionById("gg")).map((r) => r.id)).toEqual(["ggn", "anyang", "yongin", "bucheon", "seongnam", "suwon"]);
    expect(childrenOf(regionById("incheon"))).toEqual([]);
    expect(childrenOf(null)).toEqual([]);
  });
  it("estimateRegion — 강남역 좌표는 강남, 해운대는 부산", () => {
    expect(estimateRegion(37.4979, 127.0276)).toBe("gangnam");
    expect(estimateRegion(35.1587, 129.1604)).toBe("busan");
  });
});

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
