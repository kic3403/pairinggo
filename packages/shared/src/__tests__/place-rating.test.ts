import { describe, expect, it } from "vitest";
import { amenitiesFromGoogle, amenityChips, pickGoogleMatch, ratingText, type GoogleCandidate } from "../place-rating";

const kakao = { name: "투뿔등심 강남점", lat: 37.4979, lng: 127.0276 };
const c = (name: string, lat: number, lng: number, rating = 4.0, count = 100): GoogleCandidate => ({ id: name, name, lat, lng, rating, count });

describe("구글 장소 평점 대조", () => {
  it("이름이 같거나 한쪽이 다른 쪽을 포함하고 150m 안이면 맞춘다", () => {
    expect(pickGoogleMatch(kakao, [c("투뿔등심 강남역점", 37.4981, 127.0279)])?.name).toBe("투뿔등심 강남역점");
    expect(pickGoogleMatch(kakao, [c("투뿔등심", 37.4981, 127.0279)])?.name).toBe("투뿔등심");
  });
  it("멀리 있는 같은 이름(다른 지점)은 맞추지 않는다", () => {
    expect(pickGoogleMatch(kakao, [c("투뿔등심 강남점", 37.52, 127.03)])).toBeNull();
  });
  it("이름이 다르면 가까워도 맞추지 않는다", () => {
    expect(pickGoogleMatch(kakao, [c("국밥쟁이", 37.4979, 127.0276)])).toBeNull();
  });
  it("후보가 여럿이면 가장 가까운 이름 일치를 고르고, 리뷰가 없는 곳(평점 없음)은 건너뛴다", () => {
    const got = pickGoogleMatch(kakao, [c("투뿔등심 강남점", 37.4990, 127.0290), c("투뿔등심 강남점", 37.4980, 127.0277), { ...c("투뿔등심 강남점", 37.4979, 127.0276), rating: null, count: 0 }]);
    expect(got?.lat).toBe(37.4980);
  });
  it("리뷰 5개 미만은 평점을 쓰지 않는다", () => {
    expect(pickGoogleMatch(kakao, [c("투뿔등심 강남점", 37.4979, 127.0276, 5, 4)])).toBeNull();
    expect(pickGoogleMatch(kakao, [c("투뿔등심 강남점", 37.4979, 127.0276, 5, 5)])).not.toBeNull();
  });
  it("평점 표시 — 소수 한 자리, 리뷰 수는 천 단위 구분", () => {
    expect(ratingText({ score: 3.9, count: 404 })).toBe("★ 3.9 (404)");
    expect(ratingText({ score: 4, count: 1234 })).toBe("★ 4.0 (1,234)");
  });
});

describe("식당 평점순 정렬", () => {
  it("평점 높은 순, 같으면 리뷰 많은 순, 평점 없는 곳은 원래 순서로 뒤에", async () => {
    const { sortByRating } = await import("../place-rating");
    const g = (score: number, count: number) => ({ score, count, source: "google" as const });
    const out = sortByRating([{ n: "a" }, { n: "b", rating: g(4.1, 10) }, { n: "c", rating: g(4.5, 20) }, { n: "d" }, { n: "e", rating: g(4.5, 300) }]);
    expect(out.map((x) => x.n)).toEqual(["e", "c", "b", "a", "d"]);
  });
});

describe("구글 편의 정보(주차·단체·예약)", () => {
  it("주차 — 무료가 하나라도 있으면 무료, 아니면 유료·발레·노상 순", () => {
    expect(amenitiesFromGoogle({ parkingOptions: { freeParkingLot: true, paidParkingLot: true } }).parking).toBe("free");
    expect(amenitiesFromGoogle({ parkingOptions: { freeGarageParking: true } }).parking).toBe("free");
    expect(amenitiesFromGoogle({ parkingOptions: { paidParkingLot: true, freeStreetParking: true } }).parking).toBe("paid");
    expect(amenitiesFromGoogle({ parkingOptions: { valetParking: true } }).parking).toBe("valet");
    expect(amenitiesFromGoogle({ parkingOptions: { freeStreetParking: true } }).parking).toBe("street");
  });
  it("모든 항목이 false로 적혀 있을 때만 '주차 불가', 정보가 없으면 말하지 않는다", () => {
    expect(amenitiesFromGoogle({ parkingOptions: { freeParkingLot: false, paidParkingLot: false } }).parking).toBe("none");
    expect(amenitiesFromGoogle({ parkingOptions: {} }).parking).toBeNull();
    expect(amenitiesFromGoogle({}).parking).toBeNull();
  });
  it("단체·예약은 적혀 있는 값 그대로, 없으면 null", () => {
    expect(amenitiesFromGoogle({ goodForGroups: true, reservable: false })).toEqual({ parking: null, groups: true, reservable: false });
    expect(amenitiesFromGoogle({})).toEqual({ parking: null, groups: null, reservable: null });
  });
  it("칩 — 확인된 것만, '불가'는 주차만 보여 준다(단체·예약의 false는 빈칸과 구분이 어려워 숨김)", () => {
    expect(amenityChips({ parking: "free", groups: true, reservable: true })).toEqual([{ key: "parking", label: "주차 무료", tone: "yes" }, { key: "groups", label: "단체 가능", tone: "yes" }, { key: "reservable", label: "예약 가능", tone: "yes" }]);
    expect(amenityChips({ parking: "none", groups: false, reservable: false })).toEqual([{ key: "parking", label: "주차 불가", tone: "no" }]);
    expect(amenityChips({ parking: null, groups: null, reservable: null })).toEqual([]);
    expect(amenityChips(null)).toEqual([]);
  });
  it("대조된 후보의 편의 정보가 따라온다", () => {
    const c = { id: "g1", name: "진미식당", lat: 37.5, lng: 127, rating: 4.4, count: 120, amenities: { parking: "paid" as const, groups: true, reservable: null } };
    expect(pickGoogleMatch({ name: "진미식당", lat: 37.5, lng: 127 }, [c])?.amenities?.parking).toBe("paid");
  });
});
