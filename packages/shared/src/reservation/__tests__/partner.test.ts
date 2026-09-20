import { describe, expect, it } from "vitest";
import {
  PARTNER_KINDS, PARTNER_KIND_LABEL, PARTNER_KIND_TONE, PARTNER_RESERVATION_LABEL, cleanPartnerKind, partnerTakesReservations, validatePartnerSignup,
} from "../partner";

describe("파트너 종류 — 식당·양조장·리쿼샵", () => {
  it("값이 없거나 이상하면 식당", () => {
    expect(cleanPartnerKind(undefined)).toBe("restaurant");
    expect(cleanPartnerKind("shop")).toBe("restaurant");
    expect(cleanPartnerKind("brewery")).toBe("brewery");
    expect(cleanPartnerKind("liquor")).toBe("liquor");
  });
  it("이름표와 예약 여부", () => {
    expect(PARTNER_KINDS).toEqual(["restaurant", "brewery", "liquor"]);
    expect(PARTNER_KIND_LABEL.brewery).toBe("양조장");
    expect(PARTNER_KIND_LABEL.liquor).toBe("리쿼샵");
    // 예약은 업종과 무관 — 켠 매장이면 받는다(양조장 = 방문 시음, 리쿼샵 = 방문 픽업)
    expect(partnerTakesReservations("restaurant")).toBe(true);
    expect(partnerTakesReservations("brewery")).toBe(true);
    expect(PARTNER_RESERVATION_LABEL.brewery).toBe("방문 시음 예약");
    expect(PARTNER_RESERVATION_LABEL.liquor).toBe("방문 픽업 예약");
  });
  it("가입 신청에 종류가 담긴다 — 안 고르면 식당", () => {
    const base = { email: "a@b.co", password: "Abcd1234!", name: "홍길동", phone: "010-1234-5678", kakaoPlaceId: "123", ownerName: "홍길동", bizNo: "1208147521", agree: true as const };
    expect(validatePartnerSignup({ ...base, kind: "brewery" })).toMatchObject({ ok: true, value: { kind: "brewery" } });
    expect(validatePartnerSignup(base)).toMatchObject({ ok: true, value: { kind: "restaurant" } });
  });
});

describe("파트너 도장 색", () => {
  it("양조장·리쿼샵은 네이비, 식당은 주황(로고 두 색)", () => {
    expect(PARTNER_KIND_TONE.brewery).toBe("navy");
    expect(PARTNER_KIND_TONE.liquor).toBe("navy");
    expect(PARTNER_KIND_TONE.restaurant).toBe("food");
  });
  it("모든 업종에 색이 있다", () => {
    expect(PARTNER_KINDS.every((k) => PARTNER_KIND_TONE[k])).toBe(true);
  });
});
