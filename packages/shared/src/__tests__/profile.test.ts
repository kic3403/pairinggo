import { describe, expect, it } from "vitest";
import { ageBand, ageOn, birthDateToDigits, birthDigitsToDate, cleanNickname, nicknameProblem, profileProblem, SIDO_OPTIONS } from "../profile";

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
  it("생년월일 8자리 입력(19871024) → YYYY-MM-DD, 없는 날짜·자릿수 틀림은 null", () => {
    expect(birthDigitsToDate("19871024")).toBe("1987-10-24");
    expect(birthDigitsToDate(" 19871024 ")).toBe("1987-10-24");
    expect(birthDigitsToDate("20000229")).toBe("2000-02-29");   // 윤년
    expect(birthDigitsToDate("19990229")).toBeNull();           // 평년 2월 29일
    expect(birthDigitsToDate("19870231")).toBeNull();
    expect(birthDigitsToDate("19871324")).toBeNull();
    expect(birthDigitsToDate("1987-10-24")).toBeNull();          // 8자리 숫자만
    expect(birthDigitsToDate("8710241")).toBeNull();
    expect(birthDigitsToDate("198710245")).toBeNull();
    expect(birthDigitsToDate("")).toBeNull();
    expect(birthDateToDigits("1987-10-24")).toBe("19871024");
    expect(birthDateToDigits(null)).toBe("");
  });
  it("없는 날짜는 나이를 계산하지 않고 안내 문구에 8자리 예시를 보여 준다", () => {
    expect(ageOn("1987-02-31", ON)).toBeNull();
    expect(profileProblem({ gender: "m", birthDate: null, sido: "서울특별시" }, ON)).toMatch(/8자리/);
  });
  it("닉네임 — 앞뒤 공백 제거 후 2~12자, 링크·이메일·운영자 사칭 금지", () => {
    expect(nicknameProblem("곰돌이푸훗")).toBeNull();
    expect(nicknameProblem("  술꾼 A  ")).toBeNull();
    expect(nicknameProblem("🍶막걸리러버")).toBeNull();
    expect(nicknameProblem("")).toMatch(/닉네임/);
    expect(nicknameProblem("가")).toMatch(/2~12자/);
    expect(nicknameProblem("가나다라마바사아자차카타파")).toMatch(/2~12자/);   // 13자
    expect(nicknameProblem("me@mail.com")).toMatch(/이메일|링크/);
    expect(nicknameProblem("www.site")).toMatch(/링크/);
    expect(nicknameProblem("http맛집")).toMatch(/링크/);
    expect(nicknameProblem("페어링GO 운영자")).toMatch(/쓸 수 없는/);
    expect(nicknameProblem("관리자")).toMatch(/쓸 수 없는/);
    expect(nicknameProblem("회원")).toMatch(/쓸 수 없는/);
    expect(cleanNickname("  술꾼   A ")).toBe("술꾼 A");
  });
  it("시도 16개 — 통합특별시 반영", () => {
    expect(SIDO_OPTIONS).toHaveLength(16);
    expect(SIDO_OPTIONS).toContain("전남광주통합특별시");
    expect(SIDO_OPTIONS.some((s) => s.startsWith("광주"))).toBe(false);
  });
});
