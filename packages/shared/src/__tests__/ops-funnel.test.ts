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
  it("유입 경로 — 세션마다 하나, 처음 나온 바깥 유입", () => {
    const f = opsFunnel([
      ev("screen", "a", { path: "/", ref: "https://search.naver.com/x" }), ev("screen", "a", { path: "/drinks", ref: "https://pairinggo.kr/" }),
      ev("screen", "b", { path: "/", ref: "" }), ev("screen", "b", { path: "/my", ref: "https://nid.naver.com/x" }),            // 로그인 왕복은 유입이 아님 → 직접
      ev("screen", "c", { path: "/today", ref: "", q: "?utm_source=sns" }),
      ev("screen", "d", { path: "/", ref: "", via: "kakaotalk" }),
      ev("screen", "e", { path: "/", ref: "https://m.search.naver.com/" }),
      ev("screen", "g", { path: "/", ref: "https://pairinggo.kr/x" }), ev("screen", "g", { path: "/", ref: "https://www.google.com/" }),   // 나중에라도 바깥 유입이 있으면 그것
      ev("screen", "h", { path: "/" }),
    ]);
    expect(f.sessions).toBe(7);
    expect(f.sources).toEqual([
      { group: "direct", label: "직접·알 수 없음", n: 2 }, { group: "search", label: "네이버", n: 2 },
      { group: "sns", label: "SNS 글(우리 글 복사)", n: 1 }, { group: "sns", label: "카카오톡 앱 안", n: 1 }, { group: "search", label: "구글", n: 1 },
    ].sort((x, y) => y.n - x.n || x.label.localeCompare(y.label, "ko")));
    expect(f.sources.reduce((s, x) => s + x.n, 0)).toBe(f.sessions);
  });
  it("빈 기간·비율 문구", () => {
    expect(opsFunnel([])).toMatchObject({ sessions: 0, detailSessions: 0, actionSessions: 0, topDetails: [], sources: [] });
    expect(stepRate(3, 25)).toBe("12% (3/25)");
    expect(stepRate(0, 0)).toBe("—");
  });
});

describe("날씨 소식·상황 클릭(2026-10-02)", async () => {
  const { opsFunnel, summarizeWeatherRuns } = await import("../ops-funnel");
  it("situation_click은 행동이 아니라 따로 세고, utm_source=push 세션은 푸시 유입", () => {
    const f = opsFunnel([
      { name: "screen", session_id: "a", props: { path: "/foods/해물파전", q: "?d=d31&utm_source=push" } },
      { name: "situation_click", session_id: "a", props: { key: "rain" } },
      { name: "situation_click", session_id: "b", props: { key: "rain" } },
      { name: "screen", session_id: "b", props: { path: "/" } },
    ]);
    expect(f.situationClicks).toBe(2); expect(f.pushSessions).toBe(1); expect(f.actionSessions).toBe(0);
    expect(f.sources.find((s) => s.group === "push")?.label).toBe("푸시 알림");
  });
  it("발송 요약 — 기간 안 보낸 날·보낸 수", () => {
    const runs = [{ at: "2026-10-01T22:35:00Z", users: 5, sent: 2, sidos: {} }, { at: "2026-10-02T22:35:00Z", users: 5, sent: 0, sidos: {} }, { at: "2026-10-03T22:35:00Z", users: 6, sent: 3, sidos: {} }, { at: "2026-09-20T22:35:00Z", users: 1, sent: 1, sidos: {} }];
    expect(summarizeWeatherRuns(runs, "2026-10-01T00:00:00Z", "2026-10-05T00:00:00Z")).toEqual({ days: 2, sent: 5 });
  });
});
