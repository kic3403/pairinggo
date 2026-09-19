import { describe, expect, it } from "vitest";
import { blogCountNames, blogCountQueries, blogNameUsable, capByNameTotal, pickBlogCount } from "../blog-count";

describe("대중 언급 수 검색어", () => {
  it("별칭과 이름 두 가지 — 같으면 하나만", () => {
    expect(blogCountQueries({ name: "가무치소주 25도", alias: "가무치소주" }, { name: "광어회" })).toEqual(["가무치소주 광어회", "가무치소주 25도 광어회"]);
    expect(blogCountQueries({ name: "백세주", alias: "백세주" }, { name: "보쌈" })).toEqual(["백세주 보쌈"]);
    expect(blogCountQueries({ name: "송명섭막걸리", alias: null }, { name: " 김치전 " })).toEqual(["송명섭막걸리 김치전"]);
  });
  it("가장 큰 결과 수를 쓴다 — 실패한 검색은 빼고, 전부 실패면 null(0으로 덮어쓰지 않는다)", () => {
    expect(pickBlogCount([1292, 17042])).toBe(17042);
    expect(pickBlogCount([null, 99])).toBe(99);
    expect(pickBlogCount([0, 0])).toBe(0);
    expect(pickBlogCount([null, undefined])).toBeNull();
    expect(pickBlogCount([])).toBeNull();
  });
});

describe("너무 흔한 이름은 언급 수에 쓰지 않는다", () => {
  const usable = (n: string) => blogNameUsable(({ 해: 378_933_694, 달: 72_729_866, 우리막걸리: 2_098_370, 한산소곡주: 29_282, 지평막걸리: 124_252 } as Record<string, number>)[n] ?? 0);
  it("이름 단독 검색이 100만 건을 넘으면 뺀다", () => {
    expect(blogNameUsable(29_282)).toBe(true);
    expect(blogNameUsable(124_252)).toBe(true);
    expect(blogNameUsable(2_098_370)).toBe(false);
    expect(blogNameUsable(null)).toBe(true);        // 검색 실패는 판단하지 않는다
  });
  it("쓸 수 있는 이름만 검색어로", () => {
    expect(blogCountNames({ name: "한산소곡주", alias: "해" }, usable)).toEqual(["한산소곡주"]);
    expect(blogCountNames({ name: "우리막걸리", alias: "달" }, usable)).toEqual([]);   // 쓸 이름이 없으면 언급 수 0
    expect(blogCountNames({ name: "지평막걸리", alias: "지평막걸리" }, usable)).toEqual(["지평막걸리"]);
  });
});

describe("조합 언급 수는 이름 단독 언급 수를 넘지 못한다", () => {
  it("검색기가 이름을 쪼개 읽어 더 크게 나오면 이름 쪽으로 자른다", () => {
    expect(capByNameTotal(224_610, 84)).toBe(84);
    expect(capByNameTotal(1_200, 29_282)).toBe(1_200);
    expect(capByNameTotal(null, 100)).toBeNull();
    expect(capByNameTotal(500, null)).toBe(500);   // 이름 검색이 실패하면 그대로
  });
});
