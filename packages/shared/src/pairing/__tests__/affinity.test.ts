import { describe, expect, it } from "vitest";
import { affinityFacts, affinityNotes, affinityRaw, buildAffinity } from "../affinity";
import { auc, crossValidatedAuc, shuffledAuc } from "../fit-eval";
import { DATA } from "../../data";
import { profileFit } from "../../lineup/lineup";
import { EVIDENCE_TIERS } from "../review-queue";

const fp = (spice: number, fat: number) => ({ fat, spice, umami: 3, salt: 3, sweet: 1, weight: 3 });
const drinks = [{ id: "t1", category: "탁주" }, { id: "t2", category: "탁주" }, { id: "s1", category: "증류주" }, { id: "s2", category: "증류주" }];
const foods = [{ id: "j1", category: "전", profile: fp(1, 4) }, { id: "j2", category: "전", profile: fp(1, 4) }, { id: "h1", category: "회", profile: fp(1, 1) }, { id: "h2", category: "회", profile: fp(1, 1) }];
const ev = (d: string, f: string, src = "media") => ({ d, f, src });
// 탁주는 전과, 증류주는 회와 짝지어진 근거 8건(각 4건) + 맛 분석 1건(세지 않는다)
const pairings = [ev("t1", "j1"), ev("t1", "j2"), ev("t2", "j1"), ev("t2", "j2"), ev("s1", "h1"), ev("s1", "h2"), ev("s2", "h1"), ev("s2", "h2"), ev("t1", "h1", "profile")];
const m = buildAffinity({ drinks, foods, pairings });

describe("근거에서 배운 친화도", () => {
  it("근거 조합만 세고 맛 분석(profile)은 세지 않는다", () => {
    expect(m.n).toBe(8);
    expect(m.evidence.has("t1|h1")).toBe(false);
  });
  it("자주 짝지어진 성격은 lift > 1, 한 번도 없는 성격은 < 1", () => {
    const cat = affinityFacts(m, drinks[0], foods[2]).find((x) => x.axis === "category")!;
    // 탁주×회: 0건, 우연이면 4×4/8=2건 → (0+4)/(2+4)
    expect(cat.lift).toBeCloseTo(4 / 6, 5);
    expect(affinityRaw(m, drinks[0], foods[2])).toBeLessThan(0);
  });
  it("그 조합 자체가 근거면 자기 몫을 빼고 센다", () => {
    const x = affinityFacts(m, drinks[0], foods[0]).find((f) => f.axis === "category")!;
    expect(x.count).toBe(3);                       // 탁주×전 4건 중 자기 1건 제외
    expect(x.lift).toBeCloseTo((3 + 4) / ((3 * 3) / 7 + 4), 5);
    expect(affinityRaw(m, drinks[0], foods[0])).toBeGreaterThan(affinityRaw(m, drinks[0], foods[2]));
  });
  it("근거가 적은 술 종류는 중립 쪽으로 눌린다", () => {
    const real = buildAffinity(DATA);
    const brandy = DATA.drinks.find((d) => d.category === "브랜디")!, takju = DATA.drinks.find((d) => d.category === "탁주")!;
    const w = (d: typeof brandy) => affinityFacts(real, d, DATA.foods[0])[0].weight;
    expect(w(brandy)).toBeLessThan(0.2);
    expect(w(takju)).toBeGreaterThan(0.8);
    for (const f of DATA.foods) expect(Math.abs(affinityRaw(real, brandy, f))).toBeLessThan(0.2);
  });
  it("문구는 횟수가 충분한 칸만 — 작은 표본에서는 자주라고 말하지 않는다", () => {
    expect(affinityNotes(m, drinks[0], foods[0])).toEqual({ plus: [], minus: [] });
  });
  it("실데이터에서는 뚜렷한 칸에 문구가 붙는다", () => {
    const real = buildAffinity(DATA);
    const takju = DATA.drinks.find((d) => d.category === "탁주")!, jeon = DATA.foods.find((f) => f.category === "전")!;
    expect(affinityNotes(real, takju, jeon).plus[0]).toMatch(/^근거 조합에서 탁주 × 전: 평균의 \d\.\d배 자주 짝지어짐\(\d+건\)$/);
  });
});

describe("점수 검증 자", () => {
  it("AUC — 완벽 1, 뒤집히면 0, 동점 0.5", () => {
    expect(auc([3, 4], [1, 2])).toBe(1);
    expect(auc([1], [2, 3])).toBe(0);
    expect(auc([1, 1], [1, 1])).toBe(0.5);
  });
  it("서로 바꿔 짝지은 음성에서 실제 근거 조합은 뺀다", () => {
    const pos = [{ d: "a", f: "x" }, { d: "b", f: "y" }, { d: "a", f: "y" }];
    const seen: string[] = [];
    shuffledAuc(pos, (d, f) => { seen.push(`${d}|${f}`); return 0; });
    expect(seen.filter((k) => k === "b|x").length).toBeGreaterThan(0);   // b×x만 음성
    expect(seen.filter((k) => k === "a|y").length).toBe(1);              // a×y는 양성으로 한 번만
  });
});

describe("실데이터 — 맛 분석 점수가 근거 조합을 무작위보다 잘 골라낸다", () => {
  const D = new Map(DATA.drinks.map((d) => [d.id, d])), F = new Map(DATA.foods.map((f) => [f.id, f]));
  const pos = DATA.pairings.filter((p) => p.src && (EVIDENCE_TIERS as readonly string[]).includes(p.src) && D.get(p.d)?.profile && F.get(p.f)?.profile).map((p) => ({ d: p.d, f: p.f }));
  const fitAffinity = (train: { d: string; f: string }[]) => {
    const model = buildAffinity({ drinks: DATA.drinks, foods: DATA.foods, pairings: train.map((p) => ({ ...p, src: "media" })) });
    return (d: string, f: string) => affinityRaw(model, D.get(d)!, F.get(f)!);
  };
  it("교차검증 AUC 0.56 이상이고 손으로 짠 맛 궁합 규칙보다 높다", () => {
    const learned = crossValidatedAuc(pos, fitAffinity);
    const rule = crossValidatedAuc(pos, () => (d, f) => profileFit(D.get(d)!.profile!, D.get(d)!.abv ?? null, F.get(f)!.profile!).s);
    expect(pos.length).toBeGreaterThan(400);
    expect(learned).toBeGreaterThanOrEqual(0.56);
    expect(learned).toBeGreaterThan(rule + 0.05);
  });
  it("음식 기준으로 나눠도(처음 보는 음식) 0.56 이상", () => {
    expect(crossValidatedAuc(pos, fitAffinity, "f")).toBeGreaterThanOrEqual(0.56);
  });
});

describe("0~100 눈금", () => {
  it("모든 술×음식 조합 기준 백분위 — 잘 맞는 성격은 위, 안 맞는 성격은 아래", async () => {
    const { affinityScale } = await import("../affinity");
    const scale = affinityScale(m, drinks, foods);
    const good = scale(affinityRaw(m, drinks[0], foods[0])), bad = scale(affinityRaw(m, drinks[0], foods[2]));
    expect(good).toBeGreaterThan(50);
    expect(bad).toBeLessThan(50);
    expect(scale(-99)).toBe(0);
    expect(scale(99)).toBe(100);
  });
});
