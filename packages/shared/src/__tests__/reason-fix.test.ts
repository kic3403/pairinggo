import { describe, expect, it } from "vitest";
import { fixTemplateReason } from "../pairing/reason-fix";

describe("어색한 자동 문장 고치기", () => {
  it("조사를 맞추고 출처 갈래에 맞는 말로", () => {
    expect(fixTemplateReason("해물파전와(과) 함께 즐긴 후기·추천이 있는 조합 — 블로그 근거")).toBe("해물파전과 함께 즐겼다는 블로그 후기가 있는 조합입니다.");
    expect(fixTemplateReason("보쌈와(과) 함께 즐긴 후기·추천이 있는 조합 — 매체 근거")).toBe("보쌈과 함께 소개한 매체 글이 있는 조합입니다.");
    expect(fixTemplateReason("두부김치와(과) 함께 즐긴 후기·추천이 있는 조합 — 카페 근거")).toBe("두부김치와 함께 즐겼다는 카페 후기가 있는 조합입니다.");
    expect(fixTemplateReason("  육회와(과) 함께 즐긴 후기·추천이 있는 조합 — 블로그 근거 ")).toBe("육회와 함께 즐겼다는 블로그 후기가 있는 조합입니다.");
  });
  it("틀 문장이 아니면 손대지 않는다", () => {
    expect(fixTemplateReason("양조장이 공개 제품 정보에서 추천한 음식입니다.")).toBeNull();
    expect(fixTemplateReason("전문 매체가 소개한 조합입니다. 맛 프로필로도 바디 2점 ↔ 무게 3점 균형.")).toBeNull();
    expect(fixTemplateReason("해물파전와(과) 함께 즐긴 후기·추천이 있는 조합 — 블로그 근거 그리고 덧붙인 말")).toBeNull();
    expect(fixTemplateReason("")).toBeNull();
    expect(fixTemplateReason(null)).toBeNull();
  });
  it("고친 문장은 다시 고치지 않는다", () => {
    expect(fixTemplateReason(fixTemplateReason("보쌈와(과) 함께 즐긴 후기·추천이 있는 조합 — 블로그 근거"))).toBeNull();
  });
});
