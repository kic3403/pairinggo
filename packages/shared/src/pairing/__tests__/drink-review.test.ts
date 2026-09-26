import { describe, expect, it } from "vitest";
import { DRINK_REVIEW_BODY_MAX, cleanReviewBody, drinkReviewProblem, starGlyphs, summarizeStars } from "../drink-review";
import { PARTNER_PAIRING_ES, applyPartnerPairing, partnerEvidence, partnerPairingProblem } from "../partner-pairing";

describe("술 평가(2026-09-26)", () => {
  it("별점 1~5 정수, 한 줄 140자, 링크 금지", () => {
    expect(drinkReviewProblem({ stars: 4, body: "부드럽고 향이 좋아요" })).toBeNull();
    expect(drinkReviewProblem({ stars: 5 })).toBeNull();
    expect(drinkReviewProblem({ stars: 0 })).toMatch(/별점/);
    expect(drinkReviewProblem({ stars: 6 })).toMatch(/별점/);
    expect(drinkReviewProblem({ stars: 3.5 })).toMatch(/별점/);
    expect(drinkReviewProblem({ stars: "abc" })).toMatch(/별점/);
    expect(drinkReviewProblem({ stars: 4, body: "가".repeat(DRINK_REVIEW_BODY_MAX + 1) })).toMatch(/140자/);
    expect(drinkReviewProblem({ stars: 4, body: "여기 보세요 https://x.com" })).toMatch(/링크/);
    expect(drinkReviewProblem({ stars: 4, body: "문의 me@x.kr" })).toMatch(/링크/);
  });
  it("본문 정리 — 공백 접기·자르기", () => {
    expect(cleanReviewBody("  향이   좋아요 \n ")).toBe("향이 좋아요");
    expect(cleanReviewBody("가".repeat(200))).toHaveLength(DRINK_REVIEW_BODY_MAX);
  });
  it("평균은 3명부터, 분포는 1~5점", () => {
    expect(summarizeStars([])).toEqual({ n: 0, avg: null, hist: [0, 0, 0, 0, 0] });
    expect(summarizeStars([5, 4])).toMatchObject({ n: 2, avg: null });
    const s = summarizeStars([5, 4, 4, 7, 0]);   // 범위 밖은 버린다
    expect(s.n).toBe(3); expect(s.avg).toBe(4.3); expect(s.hist).toEqual([0, 0, 0, 2, 1]);
    expect(summarizeStars([1, 2, 3, 4, 5]).avg).toBe(3);
  });
  it("별 글자", () => {
    expect(starGlyphs(4)).toBe("★★★★☆");
    expect(starGlyphs(0)).toBe("☆☆☆☆☆");
    expect(starGlyphs(9)).toBe("★★★★★");
  });
});

describe("파트너 페어링(2026-09-26)", () => {
  it("검사 — id·이유·상한", () => {
    expect(partnerPairingProblem({ drinkId: "d12", foodId: "f3", note: "안주로 딱", countForDrink: 0 })).toBeNull();
    expect(partnerPairingProblem({ drinkId: "", foodId: "f3", countForDrink: 0 })).toMatch(/술/);
    expect(partnerPairingProblem({ drinkId: "d12", foodId: "파전", countForDrink: 0 })).toMatch(/음식/);
    expect(partnerPairingProblem({ drinkId: "d12", foodId: "f3", note: "http://x.com", countForDrink: 0 })).toMatch(/링크/);
    expect(partnerPairingProblem({ drinkId: "d12", foodId: "f3", countForDrink: 8 })).toMatch(/8개/);
    expect(partnerPairingProblem({ drinkId: "d12", foodId: "f3", countForDrink: 8, editing: true })).toBeNull();
  });
  it("근거 줄", () => {
    expect(partnerEvidence("한증류소", "")).toEqual({ source: "한증류소 제공", url: null, quote: null, who: "한증류소", tier: "official" });
    expect(partnerEvidence("한증류소", "매콤한 안주와").quote).toBe("매콤한 안주와");
  });
  it("적용 — 없거나 낮은 근거는 official 90으로, 이미 official·sommelier면 유지", () => {
    expect(applyPartnerPairing(null, "", "한증류소")).toEqual({ tier: "official", es: PARTNER_PAIRING_ES, reason: "한증류소가 직접 추천한 조합입니다." });
    expect(applyPartnerPairing({ tier: "profile", es: 86, reason: "맛 분석" }, "기름진 전과", "복순도가")).toEqual({ tier: "official", es: 90, reason: "기름진 전과" });
    expect(applyPartnerPairing({ tier: "media", es: 93, reason: "매체" }, "", "복순도가").es).toBe(93);
    const keep = { tier: "sommelier", es: 92, reason: "소믈리에" };
    expect(applyPartnerPairing(keep, "새 이유", "복순도가")).toBe(keep);
    expect(applyPartnerPairing({ tier: "official", es: 91, reason: "더술닷컴" }, "새 이유", "복순도가").reason).toBe("더술닷컴");
  });
});
