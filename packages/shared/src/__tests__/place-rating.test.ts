import { describe, expect, it } from "vitest";
import { pickGoogleMatch, ratingText, type GoogleCandidate } from "../place-rating";

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
