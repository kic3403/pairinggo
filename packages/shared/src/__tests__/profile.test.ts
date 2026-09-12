import { describe, expect, it } from "vitest";
import { ageBand, ageOn, profileProblem, SIDO_OPTIONS } from "../profile";

const ON = new Date("2026-09-12T00:00:00");

describe("회원 프로필 검증", () => {
  it("만 나이 — 생일 전후", () => {
    expect(ageOn("2000-09-12", ON)).toBe(26);
    expect(ageOn("2000-09-13", ON)).toBe(25);
    expect(ageOn("2007-09-13", ON)).toBe(18);
    expect(ageOn("2007-09-12", ON)).toBe(19);
    expect(ageOn("2000-13-01", ON)).toBeNull();
    expect(ageBand("1995-01-01", ON)).toBe("30대");
  });
  it("성별·생년월일·시도가 다 있어야 하고 만 19세 미만은 막는다", () => {
    expect(profileProblem({ gender: "m", birthDate: "1990-05-05", sido: "서울특별시" }, ON)).toBeNull();
    expect(profileProblem({ gender: "x", birthDate: "1990-05-05", sido: "서울특별시" }, ON)).toMatch(/성별/);
    expect(profileProblem({ gender: "f", birthDate: "2007-09-13", sido: "서울특별시" }, ON)).toMatch(/19세/);
    expect(profileProblem({ gender: "f", birthDate: "1990-05-05", sido: "서울" }, ON)).toMatch(/시·도/);
  });
  it("시도 16개 — 통합특별시 반영", () => {
    expect(SIDO_OPTIONS).toHaveLength(16);
    expect(SIDO_OPTIONS).toContain("전남광주통합특별시");
    expect(SIDO_OPTIONS.some((s) => s.startsWith("광주"))).toBe(false);
  });
});
