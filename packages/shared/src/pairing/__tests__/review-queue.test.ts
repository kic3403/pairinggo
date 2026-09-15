import { describe, expect, it } from "vitest";
import { buildReviewQueue, evidenceGaps, REPEAT_PENALTY } from "../review-queue";
import type { Pairing } from "../../types";

const P = (d: string, f: string, src: Pairing["src"]) => ({ d, f, src });
const ds = {
  drinks: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
  foods: [{ id: "f1" }, { id: "f2" }, { id: "f3" }],
  // d1·f1만 근거가 있다(blog). d2×f2는 맛 분석뿐 → 근거 아님
  pairings: [P("d1", "f1", "blog"), P("d2", "f2", "profile")],
};
let seq = 0;
const C = (drink_id: string | null, food_id: string | null, suggested_tier = "blog", mention_count = 1, id = ++seq) => ({ id, drink_id, food_id, suggested_tier, mention_count });

describe("근거 빈칸 계산", () => {
  it("profile·ai는 근거가 아니고, 근거 있는 조합만 pairs에 들어간다", () => {
    const g = evidenceGaps(ds);
    expect([...g.drinks].sort()).toEqual(["d2", "d3"]);
    expect([...g.foods].sort()).toEqual(["f2", "f3"]);
    expect([...g.pairs]).toEqual(["d1|f1"]);
  });
});

describe("근거 검수 대기열", () => {
  const gaps = evidenceGaps(ds);

  it("미지정·이미 근거 있는 조합·빈칸과 무관한 후보는 뺀다", () => {
    const q = buildReviewQueue([C(null, "f2"), C("d1", "f1"), C("d1", "f1", "media"), C("d2", null)], gaps);
    expect(q.items).toEqual([]);
    expect(q.totalCandidates).toBe(0);
  });

  it("술·음식 둘 다 빈칸인 조합이 한쪽만 빈칸인 조합보다 먼저", () => {
    const q = buildReviewQueue([C("d1", "f2", "media", 20), C("d3", "f3", "blog", 1)], gaps);
    expect(q.items.map((x) => [x.item.drink_id, x.item.food_id, x.gap])).toEqual([["d3", "f3", "both"], ["d1", "f2", "food"]]);
  });

  it("같은 조합은 1장으로 묶고 대표는 등급 높은 → 언급 많은 후보", () => {
    const a = C("d2", "f1", "blog", 9), b = C("d2", "f1", "media", 2), c = C("d2", "f1", "media", 5);
    const q = buildReviewQueue([a, b, c], gaps);
    expect(q.items).toHaveLength(1);
    expect(q.items[0].item.id).toBe(c.id);
    expect(q.items[0].others).toBe(2);
    expect(q.totalCandidates).toBe(3);
    expect(q.totalPairs).toBe(1);
  });

  it("한 술이 독차지하지 않게 같은 빈칸 술이 뽑힐 때마다 감점", () => {
    // d3은 언급이 많은 조합이 여럿, d2는 하나 — d2가 d3의 두 번째보다 먼저 나온다
    const q = buildReviewQueue([C("d3", "f1", "blog", 20), C("d3", "f1", "blog", 19), C("d3", "f9", "blog", 19), C("d2", "f9", "blog", 1)], gaps);
    const order = q.items.map((x) => `${x.item.drink_id}|${x.item.food_id}`);
    expect(order[0]).toBe("d3|f1");
    expect(order[1]).toBe("d2|f9");
    expect(REPEAT_PENALTY).toBeGreaterThan(20);
  });

  it("페이지 단위로 나눈다", () => {
    const many = Array.from({ length: 7 }, (_, i) => C("d3", `x${i}`, "blog", i));
    const p0 = buildReviewQueue(many, gaps, { size: 3, page: 0 });
    const p2 = buildReviewQueue(many, gaps, { size: 3, page: 2 });
    expect(p0.items).toHaveLength(3);
    expect(p2.items).toHaveLength(1);
    expect(p0.items[0].item.mention_count).toBe(6);
    expect(new Set([...p0.items, ...buildReviewQueue(many, gaps, { size: 3, page: 1 }).items, ...p2.items].map((x) => x.item.id)).size).toBe(7);
  });
});
