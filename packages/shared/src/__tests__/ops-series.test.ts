import { describe, expect, it } from "vitest";
import { bucketIndex, countByBucket, distinctByBucket, emptySeries, niceMax, seriesAxis, xLabelIndexes, yTicks } from "../ops-series";

describe("대시보드 그래프의 시간 축", () => {
  it("여러 날 — 한국 날짜로 하루 칸", () => {
    // 한국 9/29 12:00 ~ 10/2 12:00 (3일) → 9/29·9/30·10/1·10/2 네 칸
    const ax = seriesAxis({ since: "2026-09-29T03:00:00.000Z", until: "2026-10-02T03:00:00.000Z" });
    expect(ax.unit).toBe("day");
    expect(ax.buckets.map((b) => b.label)).toEqual(["9/29", "9/30", "10/1", "10/2"]);
    expect(ax.buckets[0].start).toBe("2026-09-28T15:00:00.000Z");   // 한국 9/29 0시
    expect(bucketIndex(ax, "2026-09-30T14:59:59.000Z")).toBe(1);   // 한국 9/30 23:59
    expect(bucketIndex(ax, "2026-09-30T15:00:00.000Z")).toBe(2);   // 한국 10/1 0시
    expect(bucketIndex(ax, "2026-09-28T14:00:00.000Z")).toBe(-1);
    expect(bucketIndex(ax, "2026-10-02T15:00:00.000Z")).toBe(-1);
  });
  it("하루짜리 기간 — 한 시간 칸", () => {
    // 오늘(한국 10/2 0시 ~ 14:30)
    const ax = seriesAxis({ since: "2026-10-01T15:00:00.000Z", until: "2026-10-02T05:30:00.000Z" });
    expect(ax.unit).toBe("hour");
    expect(ax.buckets).toHaveLength(15);
    expect(ax.buckets[0].label).toBe("0시"); expect(ax.buckets[14].label).toBe("14시");
    // 어제(24시간) → 24칸
    expect(seriesAxis({ since: "2026-09-30T15:00:00.000Z", until: "2026-10-01T15:00:00.000Z" }).buckets).toHaveLength(24);
  });
  it("세기 — 건수와 서로 다른 값 수", () => {
    const ax = seriesAxis({ since: "2026-09-29T15:00:00.000Z", until: "2026-10-01T15:00:00.000Z" });   // 9/30·10/1
    expect(countByBucket(ax, ["2026-09-29T16:00:00Z", "2026-09-30T01:00:00Z", "2026-09-30T16:00:00Z", null, "2020-01-01T00:00:00Z"])).toEqual([2, 1]);
    expect(distinctByBucket(ax, [
      { at: "2026-09-29T16:00:00Z", key: "a" }, { at: "2026-09-29T17:00:00Z", key: "a" }, { at: "2026-09-29T18:00:00Z", key: "b" },
      { at: "2026-09-30T16:00:00Z", key: "a" }, { at: "2026-09-30T16:00:00Z", key: null },
    ])).toEqual([2, 1]);
  });
  it("세로축 눈금 — 보기 좋은 수", () => {
    expect([0, 3, 4, 5, 9, 12, 37, 80, 160, 627].map(niceMax)).toEqual([4, 4, 4, 8, 12, 12, 40, 80, 200, 800]);
    for (const m of [1, 7, 23, 99, 451, 3000]) { expect(niceMax(m)).toBeGreaterThanOrEqual(m); expect(yTicks(niceMax(m)).every(Number.isInteger)).toBe(true); }
    expect(yTicks(20)).toEqual([0, 5, 10, 15, 20]);
  });
  it("가로축 글자 — 많으면 건너뛰고 처음과 끝은 꼭", () => {
    expect(xLabelIndexes(5)).toEqual([0, 1, 2, 3, 4]);
    const many = xLabelIndexes(31);
    expect(many[0]).toBe(0); expect(many[many.length - 1]).toBe(30); expect(many.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < many.length; i++) expect(many[i] - many[i - 1]).toBeGreaterThanOrEqual(2);
    expect(xLabelIndexes(0)).toEqual([]);
  });
  it("빈 기간·뒤집힌 기간", () => {
    expect(seriesAxis({ since: "x", until: "y" }).buckets).toEqual([]);
    const e = emptySeries({ since: "2026-09-29T15:00:00.000Z", until: "2026-10-01T15:00:00.000Z" });
    expect(e.views).toEqual([0, 0]);
  });
});
