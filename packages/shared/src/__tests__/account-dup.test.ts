import { describe, expect, it } from "vitest";
import { cleanMethods, duplicateMessage, sameIdentity } from "../account-dup";

describe("sameIdentity", () => {
  it("이메일이 같으면(대소문자·공백 무시) 같은 사람", () => {
    expect(sameIdentity({ email: " Kim@Example.com" }, { email: "kim@example.com" })).toBe("email");
  });
  it("번호가 같고 이름도 같으면 같은 사람 — 공백·하이픈 무시", () => {
    expect(sameIdentity({ name: "김 철수", phone: "010-1234-5678" }, { name: "김철수", phone: "+82 10-1234-5678" })).toBe("phone");
  });
  it("번호가 같아도 이름이 다르면 다른 사람", () => {
    expect(sameIdentity({ name: "김철수", phone: "01012345678" }, { name: "이영희", phone: "01012345678" })).toBeNull();
  });
  it("한쪽에 이름이 없으면 번호만으로(페어링GO — 실명을 받지 않음)", () => {
    expect(sameIdentity({ phone: "01012345678" }, { name: "김철수", phone: "01012345678" })).toBe("phone");
  });
  it("빈 값끼리는 같다고 보지 않는다", () => {
    expect(sameIdentity({ email: null, phone: null }, { email: "", phone: "" })).toBeNull();
    expect(sameIdentity({ phone: "123" }, { phone: "123" })).toBeNull();
  });
});

describe("duplicateMessage", () => {
  it("가입한 방법을 알려 준다(순서 고정·모르는 값 제거)", () => {
    expect(duplicateMessage("naver,email,hack")).toBe("이미 가입된 계정이 있어요. 이메일·네이버로 가입하셨어요 — 그 방법으로 로그인해 주세요.");
    expect(cleanMethods(["google", "kakao", "kakao"])).toEqual(["kakao", "google"]);
  });
  it("파트너 앱은 설정에서 연결 안내를 덧붙인다", () => {
    expect(duplicateMessage(["kakao"], "partner")).toContain("설정 → 로그인 방법");
  });
  it("방법을 모르면 일반 안내", () => {
    expect(duplicateMessage(null)).toBe("이미 가입된 계정이 있어요. 원래 가입한 방법으로 로그인해 주세요.");
  });
});
