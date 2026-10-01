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
    expect(t).not.toContain("방문 흐름");
    // 방문 흐름을 주면 회원 구성 앞에 들어간다
    const f = { sessions: 150, detailSessions: 26, actionSessions: 2, saves: 3, guestSaves: 1, buyClicks: 2, restaurantClicks: 1, shares: 4, cardSaves: 2, guideViews: 5, todayViews: 13, topDetails: [{ path: "/drinks/복순도가-손막걸리", n: 22 }, { path: "/foods/해물파전", n: 16 }] };
    const t2 = reportText(m, d, f);
    expect(t2).toContain("· 방문 150 → 술·음식 상세를 봄 26 (방문의 17% (26/150))");
    expect(t2).toContain("· 저장·구매·식당·공유 중 하나라도 2 (상세 본 세션의 8% (2/26))");
    expect(t2).toContain("· 저장 3(비로그인 1) · 구매 링크 2 · 식당 링크 1 · 공유 4(그림 카드 2)");
    expect(t2).toContain("· 많이 본 상세 — 복순도가 손막걸리 22 · 해물파전 16");
    expect(t2.indexOf("방문 흐름")).toBeLessThan(t2.indexOf("회원 3명"));
  });
});

describe("대시보드 기간", async () => {
  const { opsPeriod, prevPeriod } = await import("../ops-metrics");
  const now = new Date("2026-10-01T03:00:00Z");   // 한국 12:00
  it("탭 오늘·어제·7·30, 기본 7", () => {
    expect(opsPeriod({}, now)).toMatchObject({ key: "7", days: 7, label: "최근 7일", until: now.toISOString(), prevName: "전주" });
    expect(opsPeriod({ p: "30" }, now)).toMatchObject({ since: "2026-09-01T03:00:00.000Z", prevName: "전달" });
    expect(opsPeriod({ p: "today" }, now)).toMatchObject({ key: "today", since: "2026-09-30T15:00:00.000Z", until: now.toISOString(), prevName: "어제 같은 시간" });
    expect(opsPeriod({ p: "yesterday" }, now)).toMatchObject({ key: "yesterday", since: "2026-09-29T15:00:00.000Z", until: "2026-09-30T15:00:00.000Z", prevName: "그저께" });
    expect(opsPeriod({ p: "1" }, now).key).toBe("today");
    expect(opsPeriod({ p: "9" }, now).key).toBe("7");
  });
  it("오늘은 어제 같은 시간대와 비교", () => {
    expect(prevPeriod(opsPeriod({ p: "today" }, now))).toEqual({ since: "2026-09-29T15:00:00.000Z", until: "2026-09-30T03:00:00.000Z" });
    expect(prevPeriod(opsPeriod({ p: "yesterday" }, now))).toEqual({ since: "2026-09-28T15:00:00.000Z", until: "2026-09-29T15:00:00.000Z" });
  });
  it("직접 선택 — 한국 날짜 00시 기준, 둘 다 포함, 뒤바뀐 순서·미래 바로잡기", () => {
    const p = opsPeriod({ from: "2026-09-20", to: "2026-09-22" }, now);
    expect(p).toMatchObject({ key: "custom", days: 3, since: "2026-09-19T15:00:00.000Z", until: "2026-09-22T15:00:00.000Z", label: "09.20 ~ 09.22" });
    expect(opsPeriod({ from: "2026-09-22", to: "2026-09-20" }, now).from).toBe("2026-09-20");
    expect(opsPeriod({ from: "2026-09-30", to: "2026-12-31" }, now)).toMatchObject({ to: "2026-10-01", until: now.toISOString() });
    expect(opsPeriod({ from: "2020-01-01", to: "2026-10-01" }, now).days).toBe(366);
    expect(opsPeriod({ from: "x", to: "2026-09-20" }, now).key).toBe("7");
  });
  it("앞 기간은 같은 길이", () => {
    expect(prevPeriod({ since: "2026-09-24T00:00:00.000Z", until: "2026-10-01T00:00:00.000Z" })).toEqual({ since: "2026-09-17T00:00:00.000Z", until: "2026-09-24T00:00:00.000Z" });
  });
});
