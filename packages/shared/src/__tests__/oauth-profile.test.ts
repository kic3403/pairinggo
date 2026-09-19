import { describe, expect, it } from "vitest";
import { parseKakaoProfile, parseNaverProfile } from "../oauth-profile";

describe("간편로그인 프로필", () => {
  it("카카오 — 인증된 이메일만, 이름 없으면 닉네임, +82 번호를 010으로", () => {
    expect(parseKakaoProfile({ id: 123456789, kakao_account: { email: "Owner@Shop.kr", is_email_verified: true, name: "김사장", phone_number: "+82 10-1234-5678", profile: { nickname: "사장님" } } }))
      .toEqual({ provider: "kakao", uid: "123456789", email: "owner@shop.kr", name: "김사장", phone: "01012345678" });
    expect(parseKakaoProfile({ id: 1, kakao_account: { email: "x@y.kr", is_email_verified: false, profile: { nickname: "닉" } } }))
      .toEqual({ provider: "kakao", uid: "1", email: null, name: "닉", phone: null });
    expect(parseKakaoProfile({})).toBeNull();
  });
  it("네이버 — resultcode 00일 때만, 동의 안 한 항목은 null", () => {
    expect(parseNaverProfile({ resultcode: "00", response: { id: "abcXYZ_1", email: "a@naver.com", name: "이사장", mobile: "010-9876-5432" } }))
      .toEqual({ provider: "naver", uid: "abcXYZ_1", email: "a@naver.com", name: "이사장", phone: "01098765432" });
    expect(parseNaverProfile({ resultcode: "00", response: { id: "only" } })).toEqual({ provider: "naver", uid: "only", email: null, name: null, phone: null });
    expect(parseNaverProfile({ resultcode: "024", message: "Authentication failed" })).toBeNull();
  });
});
