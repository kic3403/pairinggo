import { describe, expect, it } from "vitest";
import { isDetailPath, opsFunnel, stepRate, type FunnelEventRow } from "../ops-funnel";

const ev = (name: string, sid: string | null, props: Record<string, unknown> = {}): FunnelEventRow => ({ name, session_id: sid, props });

describe("방문 흐름", () => {
  it("상세 주소 판정", () => {
    expect(isDetailPath("/drinks/복순도가-손막걸리")).toBe(true);
    expect(isDetailPath("/foods/해물파전")).toBe(true);
    expect(isDetailPath("/drinks")).toBe(false);
    expect(isDetailPath("/drinks/categories")).toBe(false);
    expect(isDetailPath("/drinks/복순도가-손막걸리/all")).toBe(false);
    expect(isDetailPath("/places/123")).toBe(false);
  });
  it("세션 단계와 행동 수", () => {
    const f = opsFunnel([
      ev("screen", "a", { path: "/" }), ev("screen", "a", { path: "/drinks/%EB%B0%B1%EC%84%B8%EC%A3%BC" }), ev("screen", "a", { path: "/drinks/%EB%B0%B1%EC%84%B8%EC%A3%BC" }),
      ev("save", "a", { guest: true }), ev("save", "a", {}), ev("buy_link_click", "a"),
      ev("screen", "b", { path: "/" }), ev("screen", "b", { path: "/guide/막걸리-안주" }), ev("screen", "b", { path: "/today" }), ev("share", "b", { channel: "card" }), ev("share", "b", { channel: "kakao" }),
      ev("screen", "c", { path: "/foods/해물파전" }), ev("restaurant_link_click", "c"),
      ev("screen", "d", { path: "/drinks" }),
      ev("screen", null, { path: "/" }),          // 세션 없는 줄은 세션 수에 안 들어감
      ev("card_tap", "d"),                          // 흐름에 안 쓰는 이벤트
    ]);
    expect(f).toMatchObject({ sessions: 4, detailSessions: 2, actionSessions: 3, saves: 2, guestSaves: 1, buyClicks: 1, restaurantClicks: 1, shares: 2, cardSaves: 1, guideViews: 1, todayViews: 1 });
    expect(f.topDetails).toEqual([{ path: "/drinks/백세주", n: 2 }, { path: "/foods/해물파전", n: 1 }]);
  });
  it("빈 기간·비율 문구", () => {
    expect(opsFunnel([])).toMatchObject({ sessions: 0, detailSessions: 0, actionSessions: 0, topDetails: [] });
    expect(stepRate(3, 25)).toBe("12% (3/25)");
    expect(stepRate(0, 0)).toBe("—");
  });
});
