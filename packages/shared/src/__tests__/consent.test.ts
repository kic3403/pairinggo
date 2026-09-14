import { describe, expect, it } from "vitest";
import { CONSENT_ITEMS, CONSENT_VERSION, consentFromForm, consentProblem, needsConsent } from "../consent";

describe("가입 동의", () => {
  it("필수 항목은 이용약관·개인정보 수집·이용·만 19세 이상 확인", () => {
    expect(CONSENT_ITEMS.filter((i) => i.required).map((i) => i.key)).toEqual(["terms", "privacy", "age"]);
  });
  it("필수 동의가 하나라도 빠지면 그 항목을 안내한다", () => {
    expect(consentProblem({ terms: true, privacy: true, age: true })).toBeNull();
    expect(consentProblem({ terms: false, privacy: true, age: true })).toMatch(/이용약관/);
    expect(consentProblem({ terms: true, age: true })).toMatch(/개인정보/);
    expect(consentProblem({ terms: true, privacy: true })).toMatch(/19세/);
    expect(consentProblem({})).toMatch(/이용약관/);
  });
  it("폼 값은 체크박스가 켜졌을 때만(on) 동의로 본다", () => {
    const fd = new Map<string, string>([["consent_terms", "on"], ["consent_privacy", "on"], ["consent_age", ""]]);
    expect(consentFromForm((k) => fd.get(k) ?? null)).toEqual({ terms: true, privacy: true, age: false });
  });
  it("동의 기록이 없거나 옛 버전이면 다시 받는다", () => {
    expect(needsConsent(null)).toBe(true);
    expect(needsConsent("2020-01-01")).toBe(true);
    expect(needsConsent(CONSENT_VERSION)).toBe(false);
  });
});
