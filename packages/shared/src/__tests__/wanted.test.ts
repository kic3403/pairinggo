import { describe, expect, it } from "vitest";
import { buildWantedList, wantedLinks, type WantedInput } from "../wanted";

const catalog = [{ name: "한산소곡주", alias: "소곡주" }, { name: "풍정사계 춘", alias: "풍정사계" }];
const foods = [{ name: "해물파전", alias: ["파전"] }];

describe("없는 술 요청 모으기", () => {
  it("카탈로그에 있는 술·음식·잡음은 뺀다", () => {
    const rows = buildWantedList([
      { name: "한산소곡주", source: "search", count: 9 },
      { name: "소곡주", source: "search", count: 4 },       // 별칭
      { name: "파전", source: "search", count: 3 },          // 음식
      { name: "막걸리", source: "search", count: 50 },       // 잡음
      { name: "ㅋ", source: "search" },                      // 너무 짧음
      { name: "오미자 스파클링", source: "search", count: 2 },
    ], catalog, foods);
    expect(rows.map((r) => r.name)).toEqual(["오미자 스파클링"]);
  });

  it("같은 이름은 출처를 합치고, 식당 메뉴판이 가장 무겁다", () => {
    const inputs: WantedInput[] = [
      { name: "오미로제 스파클링", source: "search", count: 5, at: "2026-09-01" },
      { name: "오미로제스파클링", source: "menu", where: "한밭식당", at: "2026-09-18" },
      { name: "달빛유자", source: "search", count: 7, at: "2026-09-10" },
    ];
    const [first, second] = buildWantedList(inputs, catalog, foods);
    expect(first.name).toBe("오미로제 스파클링");        // 5×1 + 1×3 = 8
    expect(first.by).toEqual({ search: 5, menu: 1, pick: 0, request: 0 });
    expect(first.places).toEqual(["한밭식당"]);
    expect(first.lastAt).toBe("2026-09-18");
    expect(second.name).toBe("달빛유자");                 // 7×1 = 7
  });

  it("카탈로그 이름이 그 말을 품고 있으면 이미 있는 술로 본다", () => {
    expect(buildWantedList([{ name: "풍정사계", source: "menu" }], catalog, foods)).toEqual([]);
  });

  it("최소 횟수·개수 제한", () => {
    const rows = buildWantedList([{ name: "가", source: "search" }, { name: "새로운술", source: "search", count: 1 }], catalog, foods, { min: 2 });
    expect(rows).toEqual([]);
  });

  it("찾아볼 링크", () => {
    const l = wantedLinks("오미로제");
    expect(l.thesool).toContain("thesool.com");
    expect(l.naver).toContain("%EC%A0%84%ED%86%B5%EC%A3%BC");   // "전통주"를 붙여 검색
  });
});
