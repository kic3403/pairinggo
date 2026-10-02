import { describe, expect, it } from "vitest";
import { cleanPushPref, expertPush, likePush, requestPush, weeklyDigest } from "../push-digest";

describe("주간 소식(2026-09-26)", () => {
  it("내용이 없으면 보내지 않는다", () => {
    expect(weeklyDigest({ savedNews: [], trendUp: [], unrated: 0, newDrinks: 0 })).toBeNull();
    expect(weeklyDigest({ savedNews: [{ name: "x", slug: "x", pairings: 0, products: 0 }], trendUp: [], unrated: 0, newDrinks: 0 })).toBeNull();
  });
  it("저장한 술 소식이 맨 앞, 눌렀을 때 그 술로", () => {
    const m = weeklyDigest({
      savedNews: [{ name: "한산소곡주", slug: "한산소곡주", pairings: 2, products: 1 }, { name: "이강주", slug: "이강주", pairings: 1, products: 0 }],
      trendUp: [{ name: "복순도가", slug: "복순도가", delta: 4 }, { name: "감싸주는 날", slug: "x", delta: null }],
      unrated: 3, newDrinks: 5,
    })!;
    expect(m.title).toBe("이번 주 페어링GO 소식");
    expect(m.body).toBe("저장한 한산소곡주에 새 페어링 2개·구매 상품 1개 외 1종 · 급상승 복순도가 ▲4 외 1 · 새로 들어온 술 5종");
    expect(m.url).toBe("/drinks/한산소곡주");
    expect(m.tag).toBe("weekly");
  });
  it("급상승만 있으면 리포트로, 먹어봤나요만 있으면 마이페이지로", () => {
    expect(weeklyDigest({ savedNews: [], trendUp: [{ name: "감싸주는 날", slug: "x", delta: null }], unrated: 0, newDrinks: 0 })).toMatchObject({ body: "급상승 감싸주는 날 NEW", url: "/report" });
    expect(weeklyDigest({ savedNews: [], trendUp: [], unrated: 2, newDrinks: 0 })).toMatchObject({ body: "먹어봤나요? 2개가 기다려요", url: "/my" });
  });
  it("설정 정리·활동 문구", () => {
    expect(cleanPushPref(null)).toEqual({ weekly: true, activity: true, weather: true });
    expect(cleanPushPref({ weekly: false })).toEqual({ weekly: false, activity: true, weather: true });
    expect(requestPush("금과명주", "done", "금과명주", "금과명주")).toMatchObject({ url: "/drinks/금과명주", body: "‘금과명주’ — 어울리는 음식을 확인해 보세요" });
    expect(requestPush("금과", "done", "금과명주", "금과명주").body).toContain("→ 금과명주");
    expect(requestPush("금과명주", "rejected", null, null, "단종")).toMatchObject({ url: "/my#requests", body: "‘금과명주’ · 단종" });
    expect(likePush("히히히힣", "이강주", "육회").body).toBe("히히히힣님이 ‘이강주 × 육회’ 추천을 좋아해요");
  });
});

describe("expertPush", () => {
  it("승인은 검수 화면, 반려는 사유", () => {
    expect(expertPush("approved").url).toBe("/expert");
    expect(expertPush("rejected", "증빙 부족").body).toBe("사유: 증빙 부족");
    expect(expertPush("suspended").tag).toBe("expert");
  });
});


describe("날씨 소식(2026-10-02)", async () => {
  const { weatherPush, cleanPushPref } = await import("../push-digest");
  const pair = { drink: "느린마을막걸리", food: "해물파전", fslug: "해물파전", d: "d31", conf: "근거 확인" };
  it("비·눈·추움만 보내고, 조합이 없으면 보내지 않는다", () => {
    expect(weatherPush({ key: "rain", icon: "☔", sido: "서울", temp: 18, precip: "rain" }, pair)).toEqual({ title: "☔ 오늘 서울에 비 와요", body: "막걸리에 전 어때요? 느린마을막걸리 × 해물파전 · 근거 확인", url: "/foods/해물파전?d=d31&utm_source=push", tag: "weather" });
    expect(weatherPush({ key: "cold", icon: "🧣", sido: "강원", temp: -2.6, precip: "none" }, pair)?.title).toBe("🧣 오늘 강원 -3℃, 추워요");
    expect(weatherPush({ key: "warm", icon: "🌿", sido: "서울", temp: 22, precip: "none" }, pair)).toBeNull();
    expect(weatherPush({ key: "rain", icon: "☔", sido: "서울", temp: 18, precip: "rain" }, null)).toBeNull();
  });
  it("설정 기본값은 켜짐, 끄면 꺼짐", () => {
    expect(cleanPushPref(null).weather).toBe(true); expect(cleanPushPref({ weather: false }).weather).toBe(false);
  });
});
