import { describe, expect, it } from "vitest";
import { recentTodayPicks, seasonOf, seasonStart, SEASON_FOODS, todayPick, weekdayKo } from "../today";
import { confidenceOf } from "../confidence";
import { DATA } from "../../data";

describe("오늘의 페어링(2026-09-27)", () => {
  it("계절과 계절 시작일", () => {
    expect(seasonOf("2026-09-27")).toBe("autumn");
    expect(seasonOf("2026-03-01")).toBe("spring");
    expect(seasonOf("2026-08-31")).toBe("summer");
    expect(seasonOf("2027-01-15")).toBe("winter");
    expect(seasonStart("2027-01-15")).toBe("2026-12-01");
    expect(seasonStart("2026-12-20")).toBe("2026-12-01");
    expect(seasonStart("2026-10-10")).toBe("2026-09-01");
    expect(weekdayKo("2026-09-27")).toBe("일");
  });
  it("계절 제철 음식 이름은 모두 카탈로그에 있다", () => {
    const names = new Set(DATA.foods.map((f) => f.name));
    for (const list of Object.values(SEASON_FOODS)) for (const n of list) expect(names.has(n), n).toBe(true);
  });
  it("같은 날짜면 같은 조합, 근거 확인 조합만", () => {
    const a = todayPick(DATA, "2026-09-27")!, b = todayPick(DATA, "2026-09-27")!;
    expect(a.main).toBe(b.main);
    expect(confidenceOf(a.main)).toBe("confirmed");
    expect(a.pool).toBeGreaterThan(50);
  });
  it("한 계절 안에서 후보 수만큼은 겹치지 않고, 제철 조합이 계절 앞쪽에 먼저 나온다", () => {
    const seen = new Set<string>();
    const t0 = todayPick(DATA, "2026-09-01")!;
    for (let i = 0; i < Math.min(60, t0.pool); i++) {
      const d = new Date(Date.parse("2026-09-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
      const t = todayPick(DATA, d)!;
      const k = `${t.main.d}|${t.main.f}`;
      expect(seen.has(k)).toBe(false); seen.add(k);
      expect(t.seasonal).toBe(i < t.seasonalPool);
    }
    expect(t0.seasonalPool).toBeGreaterThan(0);
    expect(t0.headline).toMatch(/^가을 제철 /);
  });
  it("곁들이 — 같은 술의 다른 음식, 같은 음식의 다른 술, 추정 조합은 빼고", () => {
    const t = todayPick(DATA, "2026-09-27")!;
    for (const p of t.alsoFoods) { expect(p.d).toBe(t.main.d); expect(p.f).not.toBe(t.main.f); expect(confidenceOf(p)).not.toBe("estimate"); }
    for (const p of t.alsoDrinks) { expect(p.f).toBe(t.main.f); expect(p.d).not.toBe(t.main.d); expect(confidenceOf(p)).not.toBe("estimate"); }
  });
  it("지난 페어링 — 오늘 제외 최근 6일", () => {
    const r = recentTodayPicks(DATA, "2026-09-27", 6);
    expect(r.map((x) => x.date)).toEqual(["2026-09-26", "2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22", "2026-09-21"]);
  });
  it("후보가 없으면 null", () => {
    expect(todayPick({ pairings: [], foods: [] }, "2026-09-27")).toBeNull();
  });
});
