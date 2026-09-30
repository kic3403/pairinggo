import { describe, expect, it } from "vitest";
import { applyExpertReview, cleanExpertApplication, cleanTitles, expertApplicationProblem, expertBadge, expertDisplayName, expertEvidence, expertReviewProblem, expertReviewSummary, isExpertEvidenceSource } from "../expert";
import { evidenceStats } from "../confidence";

describe("전문가 표시명·신청", () => {
  it("소속이 있으면 이름 · 소속, 없으면 이름 직함(여러 개는 ·로), 직함도 없으면 이름만", () => {
    expect(expertDisplayName({ realName: "홍길동", affiliation: "○○레스토랑", titles: ["셰프"] })).toBe("홍길동 · ○○레스토랑");
    expect(expertDisplayName({ realName: "홍길동", titles: ["소믈리에", "요리연구가"] })).toBe("홍길동 소믈리에·요리연구가");
    expect(expertDisplayName({ realName: "홍길동", titles: [] })).toBe("홍길동");
    expect(expertDisplayName({ realName: "", titles: ["a"] })).toBe("");
  });
  it("실명 비공개면 닉네임으로", () => {
    expect(expertDisplayName({ realName: "홍길동", titles: ["소믈리에"], namePublic: false, penName: "막걸리요정" })).toBe("막걸리요정 소믈리에");
    expect(cleanTitles("소믈리에·요리연구가, 소믈리에")).toEqual(["소믈리에", "요리연구가"]);
    expect(cleanTitles(["a", "b", "c", "d", "e"])).toHaveLength(4);
  });
  it("신청 검사", () => {
    const ok = { realName: "홍길동", affiliation: "", titles: ["소믈리에"], intro: "전통주 10년", namePublic: true, penName: "", publicConsent: true, docsCount: 1 };
    expect(expertApplicationProblem(ok)).toBeNull();
    expect(expertApplicationProblem({ ...ok, realName: "홍" })).toContain("실명");
    expect(expertApplicationProblem({ ...ok, realName: "홍길동1" })).toContain("한글·영문");
    expect(expertApplicationProblem({ ...ok, titles: [] })).toContain("직함");
    expect(expertApplicationProblem({ ...ok, titles: ["주류 MD"] })).toBeNull();
    expect(expertApplicationProblem({ ...ok, intro: "블로그 http://x.com" })).toContain("링크");
    expect(expertApplicationProblem({ ...ok, docsCount: 6 })).toContain("5장");
    expect(expertApplicationProblem({ ...ok, docsCount: 5 })).toBeNull();
    expect(expertApplicationProblem({ ...ok, docsCount: 0 })).toContain("자격증");
    expect(expertApplicationProblem({ ...ok, publicConsent: false })).toContain("공개에 동의");
    expect(expertApplicationProblem({ ...ok, namePublic: false })).toContain("닉네임");
    expect(expertApplicationProblem({ ...ok, namePublic: false, penName: "운영자짱" })).toContain("운영자");
    expect(expertApplicationProblem({ ...ok, namePublic: false, penName: "막걸리요정" })).toBeNull();
    expect(cleanExpertApplication({ realName: "홍길동", title: "소믈리에·셰프", namePublic: "off", penName: "요정" })).toMatchObject({ titles: ["소믈리에", "셰프"], namePublic: false, penName: "요정" });
  });
});

describe("전문가 판정", () => {
  it("판정 검사 — 아님은 이유 필수", () => {
    expect(expertReviewProblem({ drinkId: "d11", foodId: "f08", verdict: "yes" })).toBeNull();
    expect(expertReviewProblem({ drinkId: "d11", foodId: "f08", verdict: "no" })).toContain("이유");
    expect(expertReviewProblem({ drinkId: "d11", foodId: "f08", verdict: "no", note: "탄산이 전을 눌러요" })).toBeNull();
    expect(expertReviewProblem({ drinkId: "x", foodId: "f08", verdict: "yes" })).toContain("술");
    expect(expertReviewProblem({ drinkId: "d11", foodId: "f08", verdict: "maybe" })).toContain("하나를");
    expect(expertReviewProblem({ drinkId: "d11", foodId: "f08", verdict: "yes", note: "www.x.com" })).toContain("링크");
  });
  it("applyExpertReview — official·sommelier는 그대로, 나머지는 sommelier 93", () => {
    expect(applyExpertReview({ tier: "official", es: 90, reason: "r" }, "n", "홍길동 소믈리에")).toEqual({ tier: "official", es: 90, reason: "r" });
    expect(applyExpertReview({ tier: "blog", es: 85, reason: "r" }, "산미가 기름기를 잡아요", "홍길동 소믈리에")).toEqual({ tier: "sommelier", es: 93, reason: "산미가 기름기를 잡아요" });
    expect(applyExpertReview({ tier: "profile", es: 95, reason: "r" }, "", "홍길동 소믈리에").es).toBe(95);
    expect(applyExpertReview(null, "", "홍길동 소믈리에").reason).toBe("홍길동 소믈리에가 어울린다고 검수한 조합입니다.");
  });
  it("근거 줄은 전문가마다 독립 출처로 센다", () => {
    const a = expertEvidence("홍길동 소믈리에", "좋아요"), b = expertEvidence("김영희 · ○○양조장", "좋아요");
    expect(isExpertEvidenceSource(a.source)).toBe(true);
    const s = evidenceStats([a, b], "sommelier");
    expect(s.n).toBe(2);
    expect(s.e).toBe(2);
  });
});

describe("전문가 배지", () => {
  const b = (yes: number, no: number) => expertBadge({ yes, no })?.key ?? null;
  it("2·5·10 문턱, 아님의 2배 규칙", () => {
    expect(b(0, 0)).toBeNull();
    expect(b(1, 0)).toBeNull();
    expect(b(2, 0)).toBe("rec");
    expect(b(2, 1)).toBe("rec");
    expect(b(2, 2)).toBeNull();
    expect(b(5, 3)).toBeNull();
    expect(b(5, 2)).toBe("strong");
    expect(b(9, 0)).toBe("strong");
    expect(b(10, 5)).toBe("best");
    expect(expertBadge(undefined)).toBeNull();
    expect(expertBadge({ yes: 10, no: 0 })?.label).toBe("전문가 Best 페어링");
  });
  it("요약", () => {
    expect(expertReviewSummary({ yes: 7, no: 1 })).toBe("전문가 7명 어울림 · 1명 아님");
    expect(expertReviewSummary({ yes: 0, no: 2 })).toBe("전문가 2명 아님");
    expect(expertReviewSummary({ yes: 0, no: 0 })).toBe("");
  });
});

describe("전문가 3단계 배지", () => {
  it("단계 정리·이름", async () => {
    const { cleanExpertTier, EXPERT_TIER_LABEL, expertTierTitle } = await import("../expert");
    expect(cleanExpertTier(3)).toBe(3); expect(cleanExpertTier("2")).toBe(2); expect(cleanExpertTier(9)).toBe(1); expect(cleanExpertTier(undefined)).toBe(1);
    expect(EXPERT_TIER_LABEL[2]).toBe("시니어 전문가");
    expect(expertTierTitle(3)).toContain("마스터 전문가");
  });
});
