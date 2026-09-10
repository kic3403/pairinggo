import { describe, expect, it } from "vitest";
import { placeQuery, fmtDistance, kakaoRouteUrl, PLACE_KEYWORD } from "../places";
import { DATA } from "../data";

describe("장소 검색어", () => {
  it("예외 사전이 있으면 바꾸고 없으면 이름 그대로", () => {
    expect(placeQuery({ name: "홍어삼합" })).toBe("홍어");
    expect(placeQuery({ name: "육회" })).toBe("육회");
    expect(placeQuery({ name: "치즈플래터" })).toBe("와인바");
  });
  it("예외 사전의 키는 전부 실제 음식 이름", () => {
    const names = new Set(DATA.foods.map((f) => f.name));
    const unknown = Object.keys(PLACE_KEYWORD).filter((k) => !names.has(k));
    expect(unknown).toEqual([]);
  });
  it("거리 표시", () => {
    expect(fmtDistance(0.8)).toBe("800m");
    expect(fmtDistance(2.34)).toBe("2.3km");
    expect(fmtDistance(null)).toBe("");
  });
  it("길찾기 링크", () => {
    expect(kakaoRouteUrl("복순도가", 35.5, 129.1)).toBe("https://map.kakao.com/link/to/%EB%B3%B5%EC%88%9C%EB%8F%84%EA%B0%80,35.5,129.1");
  });
});
