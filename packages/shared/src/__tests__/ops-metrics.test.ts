import { describe, expect, it } from "vitest";
import { ageBandOf, deltaText, demographics, reportText, shortSido } from "../ops-metrics";

describe("운영 지표 규칙", () => {
  it("전주 대비", () => {
    expect(deltaText(0, 0)).toBe("—");
    expect(deltaText(5, 0)).toBe("새로");
    expect(deltaText(10, 10)).toBe("같음");
    expect(deltaText(15, 10)).toBe("+50%");
    expect(deltaText(9, 10)).toBe("−10%");
  });
  it("나이대 — 만 나이", () => {
    const today = new Date("2026-10-01T00:00:00Z");
    expect(ageBandOf("2007-09-30", today)).toBe("20대 이하");
    expect(ageBandOf("1996-10-02", today)).toBe("20대 이하");   // 아직 29
    expect(ageBandOf("1996-10-01", today)).toBe("30대");
    expect(ageBandOf("1970-01-01", today)).toBe("50대");
    expect(ageBandOf("1960-05-05", today)).toBe("60대 이상");
    expect(ageBandOf(null, today)).toBeNull();
    expect(ageBandOf("x", today)).toBeNull();
  });
  it("시도 줄임", () => {
    expect(shortSido("서울특별시")).toBe("서울");
    expect(shortSido("대전광역시")).toBe("대전");
    expect(shortSido("충청남도")).toBe("충남"); expect(shortSido("경기도")).toBe("경기");
    expect(shortSido("전남광주통합특별시")).toBe("전남·광주");
    expect(shortSido("강원특별자치도")).toBe("강원");
    expect(shortSido("")).toBe("미입력");
  });
  it("회원 구성·리포트 글", () => {
    const d = demographics([
      { gender: "m", birth_date: "1990-01-01", sido: "대전광역시" }, { gender: "f", birth_date: "2000-01-01", sido: "서울특별시" }, { gender: null, birth_date: null, sido: "대전광역시" },
    ], new Date("2026-10-01T00:00:00Z"));
    expect(d.total).toBe(3); expect(d.gender).toEqual({ m: 1, f: 1, "?": 1 });
    expect(d.age["30대"]).toBe(1); expect(d.age["20대 이하"]).toBe(1);
    expect(d.sido[0]).toEqual({ name: "대전", n: 2 });
    const m = { since: "2026-09-24T00:00:00Z", until: "2026-10-01T00:00:00Z", cur: { visits: 10, visitors: 5, searches: 3, emptySearches: 1, saves: 2, newUsers: 1, picks: 0, reviews: 0, expertReviews: 0, reservations: 0, orders: 0 }, prev: { visits: 5, visitors: 5, searches: 0, emptySearches: 0, saves: 0, newUsers: 0, picks: 0, reviews: 0, expertReviews: 0, reservations: 0, orders: 0 } };
    const t = reportText(m, d);
    expect(t).toContain("화면 조회 10 (전주 5, +100%)");
    expect(t).toContain("회원 3명 — 남 1 · 여 1 · 미입력 1");
  });
});
