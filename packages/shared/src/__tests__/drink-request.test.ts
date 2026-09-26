import { describe, expect, it } from "vitest";
import { cleanDrinkRequest, drinkRequestProblem, drinkRequestStatusText } from "../drink-request";
import { buildWantedList } from "../wanted";

describe("없는 술 요청(2026-09-26)", () => {
  it("이름 2~60자, 메모 140자, 링크 금지", () => {
    expect(drinkRequestProblem({ query: "금과명주", memo: "전주 한옥마을에서 봤어요" })).toBeNull();
    expect(drinkRequestProblem({ query: "금" })).toMatch(/두 글자/);
    expect(drinkRequestProblem({ query: "가".repeat(61) })).toMatch(/60자/);
    expect(drinkRequestProblem({ query: "금과명주", memo: "가".repeat(141) })).toMatch(/140자/);
    expect(drinkRequestProblem({ query: "금과명주", memo: "https://x.com" })).toMatch(/링크/);
    expect(cleanDrinkRequest({ query: "  금과   명주 ", memo: null })).toEqual({ query: "금과 명주", memo: "" });
  });
  it("상태 문구", () => {
    expect(drinkRequestStatusText({ status: "open" })).toBe("확인 중");
    expect(drinkRequestStatusText({ status: "done", drinkName: "한산소곡주" })).toBe("등록됨 · 한산소곡주");
    expect(drinkRequestStatusText({ status: "rejected", adminNote: "단종" })).toBe("보류 · 단종");
  });
  it("대기열에서 회원 요청은 가장 무겁다(4)", () => {
    const rows = buildWantedList([
      { name: "금과명주", source: "search" }, { name: "금과명주", source: "search" }, { name: "금과명주", source: "search" }, { name: "금과명주", source: "search" },
      { name: "청명주", source: "request" },
    ], [], []);
    expect(rows[0].name).toBe("금과명주");             // 4×1 = 4
    expect(rows[1].name).toBe("청명주");               // 1×4 = 4 → 동점이면 총 건수 많은 쪽
    expect(rows[1].by.request).toBe(1);
    expect(rows[1].score).toBe(4);
  });
});
