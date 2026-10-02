import { describe, expect, it } from "vitest";
import { peakTrough, seasonIndex, seasonalIndex, seasonalityLabel, splitByDay, tempBand } from "../season-trends";

const pt = (period: string, ratio: number) => ({ period, ratio });

describe("계절 지수", () => {
  it("달마다 평균 ÷ 전체 평균 × 100 — 여러 해는 같은 달끼리", () => {
    // 2년치: 1월 80·120(평균 100), 7월 40·60(평균 50) → 전체 평균 75 → 1월 133.3, 7월 66.7
    const idx = seasonalIndex([pt("2024-01-01", 80), pt("2024-07-01", 40), pt("2025-01-01", 120), pt("2025-07-01", 60)]);
    expect(idx[1]).toBe(133.3); expect(idx[7]).toBe(66.7); expect(idx[3]).toBe(0);
  });
  it("계절 평균·최고·최저", () => {
    const idx = seasonalIndex(Array.from({ length: 12 }, (_, i) => pt(`2025-${String(i + 1).padStart(2, "0")}-01`, i + 1 === 10 ? 140 : i + 1 === 6 ? 70 : 100)));
    expect(seasonIndex(idx).autumn).toBeGreaterThan(seasonIndex(idx).summer);
    expect(peakTrough(idx)).toEqual({ peak: 10, trough: 6, ratio: 2 });
    expect(seasonalityLabel(2)).toBe("뚜렷"); expect(seasonalityLabel(1.2)).toBe("약간"); expect(seasonalityLabel(1.05)).toBe("거의 없음");
  });
  it("전체가 0이면 0", () => {
    expect(seasonalIndex([pt("2025-01-01", 0), pt("2025-02-01", 0)])[1]).toBe(0);
    expect(peakTrough(seasonalIndex([])).ratio).toBe(0);
  });
  it("일별 지수를 날씨로 나눠 평균 — 날이 적은 묶음은 뺀다", () => {
    const days = new Map<string, string>();
    const pts = [];
    for (let d = 1; d <= 20; d++) { const date = `2026-09-${String(d).padStart(2, "0")}`; const rain = d % 2 === 0; days.set(date, rain ? "비" : "맑음"); pts.push(pt(date, rain ? 80 : 40)); }
    days.set("2026-09-21", "눈"); pts.push(pt("2026-09-21", 99));
    const r = splitByDay(pts, days);
    expect(r["비"]).toEqual({ days: 10, mean: 80 }); expect(r["맑음"]).toEqual({ days: 10, mean: 40 }); expect(r["눈"]).toBeUndefined();
  });
  it("기온 구간", () => {
    expect([-3, 4.9, 5, 14.9, 15, 24.9, 25, 33].map(tempBand)).toEqual(["5℃ 미만", "5℃ 미만", "5~15℃", "5~15℃", "15~25℃", "15~25℃", "25℃ 이상", "25℃ 이상"]);
  });
});
