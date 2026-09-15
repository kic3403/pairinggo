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

describe("식당 결과 관련도(placeRelevance·rankPlaces)", () => {
  it("이름·분류에 음식 이름이 있으면 2, 같은 계열 분류면 1, 다른 계열이면 0", async () => {
    const { placeRelevance, rankPlaces } = await import("../places");
    const f = { name: "육회", category: "한식" };
    expect(placeRelevance({ name: "육회한판 강남점", categoryPath: "음식점 > 한식 > 육류,고기" }, f)).toBe(2);
    expect(placeRelevance({ name: "형제특수부위", categoryPath: "음식점 > 한식 > 육류,고기 > 육회" }, f)).toBe(2);
    expect(placeRelevance({ name: "국밥쟁이", categoryPath: "음식점 > 한식 > 국밥" }, f)).toBe(1);
    expect(placeRelevance({ name: "어느 카페", categoryPath: "음식점 > 카페 > 커피전문점" }, f)).toBe(0);
    expect(placeRelevance({ name: "차이룸", categoryPath: "음식점 > 중식" }, { name: "탕수육", category: "중식" })).toBe(2);   // 키워드 '중식당'의 '중식'
    expect(placeRelevance({ name: "홍콩반점", categoryPath: "음식점 > 중식 > 중국요리" }, { name: "탕수육", category: "중식" })).toBe(2);
    const out = rankPlaces([{ name: "카페", categoryPath: "음식점 > 카페" }, { name: "국밥쟁이", categoryPath: "음식점 > 한식 > 국밥" }, { name: "육회명가", categoryPath: "음식점 > 한식" }], f);
    expect(out.map((p) => p.name)).toEqual(["육회명가", "국밥쟁이", "카페"]);
  });
});
