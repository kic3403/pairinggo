import { describe, expect, it } from "vitest";
import { applyExpertReview, expertApplicationProblem, expertBadge, expertDisplayName, expertEvidence, expertReviewProblem, expertReviewSummary, isExpertEvidenceSource } from "../expert";
import { evidenceStats } from "../confidence";

describe("전문가 표시명·신청", () => {
  it("소속이 있으면 실명 · 소속, 없으면 실명 직함, 기타면 실명만", () => {
    expect(expertDisplayName("홍길동", "○○레스토랑", "셰프")).toBe("홍길동 · ○○레스토랑");
    expect(expertDisplayName("홍길동", "", "소믈리에")).toBe("홍길동 소믈리에");
    expect(expertDisplayName("홍길동", "", "기타")).toBe("홍길동");
    expect(expertDisplayName("", "a", "b")).toBe("");
  });
  it("신청 검사", () => {
    const ok = { realName: "홍길동", affiliation: "", title: "소믈리에", intro: "전통주 10년", publicConsent: true };
    expect(expertApplicationProblem(ok)).toBeNull();
    expect(expertApplicationProblem({ ...ok, realName: "홍" })).toContain("실명");
    expect(expertApplicationProblem({ ...ok, realName: "홍길동1" })).toContain("한글·영문");
    expect(expertApplicationProblem({ ...ok, title: "" })).toContain("직함");
    expect(expertApplicationProblem({ ...ok, title: "기타" })).toContain("소속");
    expect(expertApplicationProblem({ ...ok, intro: "블로그 http://x.com" })).toContain("링크");
    expect(expertApplicationProblem({ ...ok, docsCount: 4 })).toContain("3장");
    expect(expertApplicationProblem({ ...ok, publicConsent: false })).toContain("공개에 동의");
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
