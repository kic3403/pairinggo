import { describe, expect, it } from "vitest";
import { blogCountQueries, pickBlogCount } from "../blog-count";

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
