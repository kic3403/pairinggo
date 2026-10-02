import { describe, expect, it } from "vitest";
import { clipText, detailCaption, firstSentence, hashtags, todayCaption } from "../seo/share-card";

describe("공유 카드 글", () => {
  it("자르기", () => {
    expect(clipText("짧은 글", 10)).toBe("짧은 글");
    expect(clipText("달콤한 약주에 기름진 전을 곁들이면 단맛이 기름을 씻어 준다", 20)).toBe("달콤한 약주에 기름진 전을…");
    expect(clipText("가나다라마바사아자차카타파하", 8)).toBe("가나다라마바사…");
    expect(clipText("  줄\n바꿈  ", 10)).toBe("줄 바꿈");
  });
  it("해시태그 — 기호 빼고 중복 없이", () => {
    expect(hashtags(["페어링GO", "한산 소곡주", "해물파전", "한산소곡주", "", null, "탁주·막걸리"])).toBe("#페어링GO #한산소곡주 #해물파전 #탁주막걸리");
  });
  it("오늘의 페어링 글", () => {
    const t = todayCaption({ dateLabel: "10월 1일 (목)", headline: "가을 제철 대하구이와 함께", drink: "한산소곡주", drinkMeta: "약주 · 18% · 한산소곡주", food: "대하구이", confidence: "근거 확인 · 출처 2곳", quote: "달큰한 소곡주가 대하의 단맛을 받쳐 준다", who: "양조장", category: "약주", base: "https://pairinggo.kr" });
    expect(t).toContain("한산소곡주 × 대하구이");
    expect(t).toContain("“달큰한 소곡주가 대하의 단맛을 받쳐 준다” — 양조장");
    expect(t).toContain("https://pairinggo.kr/today?utm_source=sns");
    expect(t).toContain("#한산소곡주 #대하구이 #약주");
    expect(t).toContain("만 19세");
    expect(todayCaption({ dateLabel: "x", headline: "h", drink: "a", food: "b", confidence: "c", base: "u" })).not.toContain("“");
    const r = todayCaption({ dateLabel: "x", headline: "h", drink: "a", food: "b", confidence: "c", base: "u", reason: "양조장이 추천한 음식입니다. 맛 프로필로 봐도 균형." });
    expect(r).toContain("양조장이 추천한 음식입니다.");
    expect(r).not.toContain("“");
    expect(r).not.toContain("맛 프로필로");
  });
  it("상세 글 — 등급과 근거 표시를 줄마다", () => {
    const t = detailCaption({ side: "drink", name: "복순도가 손막걸리", meta: "탁주 · 6.5% · 복순도가", total: 29, base: "https://pairinggo.kr", path: "/drinks/복순도가-손막걸리",
      items: [{ name: "해물파전", grade: "찰떡", conf: "근거 확인 · 출처 3곳" }, { name: "두부김치", grade: "시도해 볼 만", conf: "추정" }] });
    expect(t.split("\n")[0]).toBe("복순도가 손막걸리엔 이 음식");
    expect(t).toContain("1. 해물파전 — 찰떡 (근거 확인 · 출처 3곳)");
    expect(t).toContain("2. 두부김치 — 시도해 볼 만 (추정)");
    expect(t).toContain("어울리는 음식 29가지 추천 → https://pairinggo.kr/drinks/복순도가-손막걸리?utm_source=sns");
    expect(t).toContain("#복순도가손막걸리 #해물파전 #두부김치 #안주추천");
    const f = detailCaption({ side: "food", name: "해물파전", total: 171, base: "u", path: "/foods/해물파전", items: [] });
    expect(f.split("\n")[0]).toBe("해물파전엔 이 술");
    expect(f).toContain("어울리는 술 171가지");
    expect(f).toContain("#술추천");
  });
  it("첫 문장 — 화살표 기호는 가운뎃점", () => {
    expect(firstSentence("추천한 음식입니다. 바디 3점 \u2194 무게 4점 균형.")).toBe("추천한 음식입니다.");
    expect(firstSentence("바디 3점 \u2194 무게 4점 균형")).toBe("바디 3점 · 무게 4점 균형");
  });
});
