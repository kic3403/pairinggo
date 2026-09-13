import { describe, expect, it } from "vitest";
import { DATA } from "../../data";
import { PICK_LABEL, pickOf } from "../pick";
import { MIN_N, summarizeRatings, wilsonLower } from "../ratings";

describe("전문가픽 · 대중픽 · 맛 분석", () => {
  it("출처 등급 → 묶음", () => {
    expect(pickOf("official")).toBe("expert");
    expect(pickOf("sommelier")).toBe("expert");
    expect(pickOf("blog")).toBe("public");
    expect(pickOf("media")).toBe("public");
    expect(pickOf("profile")).toBe("profile");
    expect(pickOf("ai")).toBe("profile");
    expect(pickOf(undefined)).toBe("profile");
    expect(PICK_LABEL.expert).toBe("전문가픽");
    expect(PICK_LABEL.public).toBe("대중픽");
  });
  it("실데이터: 세 묶음 합이 전체", () => {
    const c = { expert: 0, public: 0, profile: 0 };
    for (const p of DATA.pairings) c[pickOf(p.src)]++;
    expect(c.expert + c.public + c.profile).toBe(DATA.pairings.length);
    expect(c.expert).toBeGreaterThan(0);
    expect(c.public).toBeGreaterThan(0);
  });
});

describe("먹어봤어요 평가 요약", () => {
  it("평가가 없으면 비율을 말하지 않는다", () => {
    expect(summarizeRatings(null)).toMatchObject({ n: 0, goodPct: null, verdict: "none" });
  });
  it(`${MIN_N}명 미만은 인원수만`, () => {
    const s = summarizeRatings({ good: 2 });
    expect(s.verdict).toBe("few");
    expect(s.text).toBe("먹어본 사람 2명");
  });
  it("판정 — 어울렸다 60% 이상 / 별로 절반 이상 / 그 밖엔 호불호", () => {
    expect(summarizeRatings({ good: 9, ok: 2, bad: 1 })).toMatchObject({ n: 12, goodPct: 75, verdict: "loved", text: "12명 중 9명이 어울렸다(75%)" });
    expect(summarizeRatings({ good: 1, ok: 1, bad: 3 }).verdict).toBe("disliked");
    expect(summarizeRatings({ good: 2, ok: 2, bad: 1 })).toMatchObject({ verdict: "mixed", text: "5명 평가 · 호불호가 갈려요" });
  });
  it("윌슨 하한 — 2명 중 2명(100%)이 50명 중 45명(90%)을 앞서지 못한다", () => {
    expect(wilsonLower(2, 2)).toBeLessThan(wilsonLower(45, 50));
    expect(wilsonLower(0, 0)).toBe(0);
    expect(summarizeRatings({ good: 45, ok: 3, bad: 2 }).lower).toBeGreaterThan(summarizeRatings({ good: 2 }).lower);
  });
  it("음수·빈 값에 안전", () => {
    expect(summarizeRatings({ good: -3, ok: undefined as unknown as number }).n).toBe(0);
  });
});
