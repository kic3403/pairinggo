import { describe, expect, it } from "vitest";
import { MEMBER_PICK_MIN, memberPickStatusText, memberPickSummary, validateMemberNote } from "../member";
import { pickOf, PICK_LABEL } from "../pick";
import { scorePairings } from "../score";
import type { Pairing } from "../../types";

describe("회원 추천 규칙", () => {
  it("상태 문구 — 모이는 중 / 공개 / 검수 / 숨김", () => {
    expect(memberPickStatusText("active", 1)).toBe(`${MEMBER_PICK_MIN - 1}명이 더 추천하면 공개돼요 (1/${MEMBER_PICK_MIN})`);
    expect(memberPickStatusText("active", MEMBER_PICK_MIN)).toBe(`공개됨 · 회원 ${MEMBER_PICK_MIN}명 추천`);
    expect(memberPickStatusText("review", 1)).toContain("검수 중");
    expect(memberPickStatusText("hidden", 5)).toContain("숨겼");
    expect(memberPickSummary(3)).toBe("회원 3명 추천");
  });
  it("글 검사 — 140자, 링크 금지, 빈 글 허용", () => {
    expect(validateMemberNote("")).toBeNull();
    expect(validateMemberNote("ㄱ".repeat(140))).toBeNull();
    expect(validateMemberNote("ㄱ".repeat(141))).toContain("140자");
    expect(validateMemberNote("여기서 사세요 https://x.com")).toContain("링크");
  });
  it("회원픽 묶음 — src user는 전문가픽·대중픽과 별도", () => {
    expect(pickOf("user")).toBe("member");
    expect(PICK_LABEL.member).toBe("회원픽");
  });
  it("점수 — 블로그 후기와 같은 급(+0.5), 근거 링크 보너스 없음 → 찰떡에 닿지 않는다", () => {
    const mk = (over: Partial<Pairing>): Pairing => ({ d: "d01", f: "f01", es: 85, reason: "", blog: 100, src: "user", pf: { s: 61, plus: [], minus: [] }, ...over });
    const s = scorePairings([mk({}), mk({ f: "b", src: "blog" })]);
    expect(s[0].parts.tier).toBe(0.5);
    expect(s[0].parts.ev).toBe(0);
    expect(s[0].base).toBe(s[1].base);
    expect(scorePairings([mk({ blog: 100000, pf: { s: 100, plus: [], minus: [] } })])[0].grade.key).not.toBe("best");
  });
});
