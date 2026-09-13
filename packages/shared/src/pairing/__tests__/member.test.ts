import { describe, expect, it } from "vitest";
import { MEMBER_PICK_LIKES_MIN, MEMBER_PICK_MIN, memberPickPublishes, memberPickStatusText, memberPickSummary, validateMemberNote } from "../member";
import { pickOf, PICK_LABEL } from "../pick";
import { scorePairings } from "../score";
import type { Pairing } from "../../types";

describe("회원 추천 규칙", () => {
  it("상태 문구 — 글은 바로 게시, 카드 조건은 글 수 또는 하트 수", () => {
    expect(memberPickStatusText("active", 1, 0)).toBe(`게시됨 · 하트 0 · 하트 ${MEMBER_PICK_LIKES_MIN}개를 더 받거나 같은 조합 글이 ${MEMBER_PICK_MIN - 1}개 더 오면 페어링 카드에 올라가요`);
    expect(memberPickStatusText("active", MEMBER_PICK_MIN, 1)).toBe("게시됨 · 하트 1 · 페어링 카드에도 올라갔어요");
    expect(memberPickStatusText("active", 1, MEMBER_PICK_LIKES_MIN)).toContain("카드에도 올라갔어요");
    expect(memberPickStatusText("review", 1)).toContain("검수 중");
    expect(memberPickStatusText("hidden", 5)).toContain("숨겼");
    expect(memberPickSummary(3)).toBe("회원 3명 추천");
    expect(memberPickSummary(1, 4)).toBe("회원 1명 추천 · ♥ 4");
    expect(memberPickPublishes(1, 0)).toBe(false);
    expect(memberPickPublishes(2, 0)).toBe(true);
    expect(memberPickPublishes(1, 3)).toBe(true);
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
