import { describe, expect, it } from "vitest";
import { lastCountedDay, pickByStaleness, scoreMentions, type MentionRow } from "../trend";

describe("회전 수집 — 할당량 안에서 오래된 것부터", () => {
  const rows: MentionRow[] = [
    { drinkId: "d1", channel: "youtube", count: 3, day: "2026-09-20" },
    { drinkId: "d2", channel: "youtube", count: 5, day: "2026-09-18" },
    { drinkId: "d3", channel: "naver", count: 9, day: "2026-09-22" },   // 다른 채널은 섞이지 않는다
  ];

  it("술마다 마지막으로 센 날을 채널별로 뽑는다", () => {
    const last = lastCountedDay(rows, "youtube");
    expect(last.get("d1")).toBe("2026-09-20");
    expect(last.get("d2")).toBe("2026-09-18");
    expect(last.has("d3")).toBe(false);
  });

  it("한 번도 안 센 술이 맨 앞, 그다음 오래된 순", () => {
    const last = lastCountedDay(rows, "youtube");
    expect(pickByStaleness(["d1", "d2", "d3", "d4"], last, 3)).toEqual(["d3", "d4", "d2"]);
  });

  it("상한만큼만 — 나머지는 다음 날로 넘어간다", () => {
    const last = lastCountedDay(rows, "youtube");
    expect(pickByStaleness(["d1", "d2"], last, 1)).toEqual(["d2"]);
    expect(pickByStaleness(["d1", "d2"], last, 0)).toEqual([]);
    expect(pickByStaleness(["d1", "d2"], last, 99)).toEqual(["d2", "d1"]);
  });

  it("여러 날 돌리면 모든 술이 한 바퀴 돈다 — 예전 방식처럼 뒤쪽이 빠지지 않는다", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const counted: MentionRow[] = [];
    for (let day = 1; day <= 3; day++) {
      const d = "2026-09-0" + day;
      for (const id of pickByStaleness(ids, lastCountedDay(counted, "youtube"), 2)) {
        counted.push({ drinkId: id, channel: "youtube", count: 1, day: d });
      }
    }
    expect(new Set(counted.map((r) => r.drinkId)).size).toBe(5);
  });

  it("마지막으로 센 값이 창 안에 있으면 점수에 계속 쓰인다", () => {
    const res = scoreMentions([
      { drinkId: "a", channel: "youtube", count: 10, day: "2026-09-16" },   // 6일 전에 센 값
      { drinkId: "b", channel: "youtube", count: 5, day: "2026-09-22" },
    ], { today: "2026-09-22", lookbackDays: 12, drinkIds: ["a", "b"] });
    expect(res.trend.a.youtube).toBe(100);
    expect(res.trend.b.youtube).toBe(50);
    expect(res.trend.a.channels).toBe(1);
  });
});
