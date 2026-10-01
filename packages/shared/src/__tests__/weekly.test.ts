import { describe, expect, it } from "vitest";
import type { Drink } from "../types";
import { DATA } from "../data";
import { weekLabel, weeklyCaption, weeklyTopByKind } from "../seo/weekly";

const drink = (id: string, kind: string | undefined, rank: number | null, extra: Record<string, unknown> = {}): Drink =>
  ({ id, name: `술${id}`, category: "탁주", brewery: `양조장${id}`, ...(kind ? { kind } : {}), ...(rank ? { trend: { rank, ...extra } } : {}) }) as unknown as Drink;

describe("주간 많이 찾는 술 — 종류별", () => {
  const drinks = [
    drink("a", undefined, 7), drink("b", "trad", 2, { prev_rank: 5, delta: 3 }), drink("c", "trad", 9, { prev_rank: 9, delta: 0 }), drink("d", "trad", 1), drink("e", "trad", null),
    drink("f", "trad", 12, { prev_rank: 10, delta: -2 }), drink("g", "trad", 15), drink("h", "trad", 20),
    drink("w1", "whisky", 3), drink("w2", "whisky", 30),            // 두 개뿐 — 순위라고 부르기엔 모자람
    drink("s1", "sake", 40), drink("s2", "sake", 41), drink("s3", "sake", 50),
    drink("v1", "wine", null),
  ];
  it("순위가 3개 이상 매겨진 종류만, 전통주·위스키·사케·와인 차례로 5개씩", () => {
    const top = weeklyTopByKind(drinks, true);
    expect(top.map((t) => t.kind)).toEqual(["trad", "sake"]);
    expect(top[0].label).toBe("전통주");
    expect(top[0].rows.map((r) => r.drink.id)).toEqual(["d", "b", "a", "c", "f"]);   // kind 없는 옛 행은 전통주
    expect(top[0].rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);                   // 종류 안에서 다시 1~5
    expect(top[1].rows).toHaveLength(3);
  });
  it("지난주 대비 배지 — 비교할 수 있을 때만, 변동 없음은 표시 안 함", () => {
    const rows = weeklyTopByKind(drinks, true)[0].rows;
    expect(rows.map((r) => r.badge)).toEqual(["NEW", "▲3", "NEW", null, "▼2"]);
    expect(weeklyTopByKind(drinks, false)[0].rows.every((r) => r.badge === null)).toBe(true);
  });
  it("다른 종류가 들어와 순위가 매겨지면 저절로 나온다", () => {
    const more = [...drinks, drink("w3", "whisky", 60), drink("v2", "wine", 70), drink("v3", "wine", 71)];
    expect(weeklyTopByKind(more, false).map((t) => t.kind)).toEqual(["trad", "whisky", "sake"]);   // 와인은 순위 있는 술이 아직 2개
    expect(weeklyTopByKind([...more, drink("v5", "wine", 80)], false).map((t) => t.kind)).toEqual(["trad", "whisky", "sake", "wine"]);
  });
  it("주 이름·글", () => {
    expect(weekLabel("2026-10-01")).toBe("10월 1주");
    expect(weekLabel("2026-10-07")).toBe("10월 1주");
    expect(weekLabel("2026-10-08")).toBe("10월 2주");
    expect(weekLabel("2026-10-31")).toBe("10월 5주");
    const t = weeklyCaption(weeklyTopByKind(drinks, true)[0], "2026-10-08", "https://pairinggo.kr");
    expect(t).toContain("10월 2주 많이 찾는 전통주 TOP 5");
    expect(t).toContain("2. 술b (양조장b) ▲3");
    expect(t).toContain("https://pairinggo.kr/weekly?utm_source=sns");
    expect(t).toContain("#전통주추천");
  });
  it("실제 카탈로그 — 지금은 전통주만", () => {
    const top = weeklyTopByKind(DATA.drinks, false);
    expect(top.map((t) => t.kind)).toEqual(["trad"]);
    expect(top[0].rows).toHaveLength(5);
  });
});
