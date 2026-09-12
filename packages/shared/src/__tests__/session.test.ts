import { describe, expect, it } from "vitest";
import { shouldClearSession, type SessionEntry } from "../session";

const ORIGIN = "https://pairinggo.vercel.app";
const base = (o: Partial<SessionEntry> = {}): SessionEntry => ({ firstInTab: false, navType: "navigate", referrer: `${ORIGIN}/drinks`, origin: ORIGIN, authPending: false, ...o });

describe("첫 화면 로그아웃 판정", () => {
  it("밖에서 들어오면 로그아웃 — 카카오톡 링크·주소창·검색 결과", () => {
    expect(shouldClearSession(base({ referrer: "" }))).toBe(true);                                  // 주소창·카카오톡
    expect(shouldClearSession(base({ referrer: "https://www.google.com/" }))).toBe(true);            // 검색 결과
    expect(shouldClearSession(base({ referrer: "https://search.naver.com/x" }))).toBe(true);
    expect(shouldClearSession(base({ firstInTab: true, referrer: "" }))).toBe(true);                 // 새 탭
  });
  it("사이트 안에서 온 이동은 유지", () => {
    expect(shouldClearSession(base())).toBe(false);
    expect(shouldClearSession(base({ referrer: `${ORIGIN}/` }))).toBe(false);
  });
  it("새로고침은 로그인을 끊지 않는다", () => {
    expect(shouldClearSession(base({ navType: "reload", referrer: "" }))).toBe(false);
  });
  it("로그인·가입 직후는 건너뛴다 — 소셜은 외부에서 돌아온다", () => {
    expect(shouldClearSession(base({ authPending: true, referrer: "https://kauth.kakao.com/" }))).toBe(false);
    expect(shouldClearSession(base({ authPending: true, firstInTab: true, referrer: "" }))).toBe(false);
  });
  it("새 탭이면 같은 출처에서 열어도 로그아웃(새로고침 제외)", () => {
    expect(shouldClearSession(base({ firstInTab: true }))).toBe(true);
    expect(shouldClearSession(base({ firstInTab: true, navType: "reload" }))).toBe(false);
  });
  it("이상한 referrer 값에도 안전하게 동작", () => {
    expect(shouldClearSession(base({ referrer: "not-a-url" }))).toBe(true);
  });
});
