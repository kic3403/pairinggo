import { describe, expect, it } from "vitest";
import { cleanPushPref, likePush, requestPush, weeklyDigest } from "../push-digest";

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
    expect(cleanPushPref(null)).toEqual({ weekly: true, activity: true });
    expect(cleanPushPref({ weekly: false })).toEqual({ weekly: false, activity: true });
    expect(requestPush("금과명주", "done", "금과명주", "금과명주")).toMatchObject({ url: "/drinks/금과명주", body: "‘금과명주’ — 어울리는 음식을 확인해 보세요" });
    expect(requestPush("금과", "done", "금과명주", "금과명주").body).toContain("→ 금과명주");
    expect(requestPush("금과명주", "rejected", null, null, "단종")).toMatchObject({ url: "/my#requests", body: "‘금과명주’ · 단종" });
    expect(likePush("히히히힣", "이강주", "육회").body).toBe("히히히힣님이 ‘이강주 × 육회’ 추천을 좋아해요");
  });
});
