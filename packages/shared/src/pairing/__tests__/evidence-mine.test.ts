import { describe, expect, it } from "vitest";
import { coMentionWindows, drinkTermsOf, finalizeMine, foodTermsOf, pairingWordWindows, quoteHasTerm, quoteVerbatim, termPositions } from "../evidence-mine";

describe("근거 늘리기 — 대목 고르기", () => {
  it("띄어쓰기가 달라도 이름을 찾는다", () => {
    expect(termPositions("오늘은 한산 소곡주를 마셨다", ["한산소곡주"])).toHaveLength(1);
  });
  it("별칭 중 양조장 이름은 술 이름으로 쓰지 않는다", () => {
    expect(drinkTermsOf({ name: "우곡생주", alias: ["우곡생주", "배혜정도가"], brewery: "배혜정도가" })).toEqual(["우곡생주"]);
    expect(foodTermsOf({ name: "해물파전", alias: ["파전", "전"] })).toEqual(["해물파전", "파전"]);
  });
  it("술과 음식이 가까이 나오는 대목만 — 멀리 떨어지면 없음", () => {
    const near = "주말에 지평막걸리를 샀다. 감자전이랑 먹으니 딱 맞았다.";
    expect(coMentionWindows(near, ["지평막걸리"], ["감자전"])[0]).toContain("감자전");
    const far = "지평막걸리 이야기." + " 다른 이야기".repeat(200) + " 감자전 레시피";
    expect(coMentionWindows(far, ["지평막걸리"], ["감자전"])).toEqual([]);
    expect(coMentionWindows("감자전만 있다", ["지평막걸리"], ["감자전"])).toEqual([]);
  });
  it("술 이름 속 음식 낱말은 음식으로 치지 않는다", () => {
    expect(coMentionWindows("딸기막걸리 한 병", ["딸기막걸리"], ["딸기"])).toEqual([]);
  });
  it("겹치는 대목은 하나로 합치고 최대 개수를 지킨다", () => {
    const t = "A술과 파전. A술과 파전. A술과 파전.";
    expect(coMentionWindows(t, ["A술"], ["파전"], { pad: 50 })).toHaveLength(1);
  });
  it("공식 페이지는 추천 낱말 앞뒤를 고른다", () => {
    const w = pairingWordWindows("제품 소개입니다. " + "가".repeat(600) + " 육회나 전과 잘 어울립니다.");
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("어울립니다");
  });
});

describe("근거 늘리기 — 판정 확인", () => {
  const src = ["지평막걸리 한 병 사 와서 감자전이랑 같이 먹었는데 궁합이 정말 좋았어요!"];
  it("인용문은 원문에 글자 그대로 있어야 한다(띄어쓰기·문장부호 무시)", () => {
    expect(quoteVerbatim("감자전이랑 같이 먹었는데 궁합이 정말 좋았어요", src)).toBe(true);
    expect(quoteVerbatim("감자전과 먹으면 궁합이 좋다", src)).toBe(false);
    expect(quoteVerbatim("감자전", src)).toBe(false);
    expect(quoteHasTerm("감자전이랑 같이", ["감자전"])).toBe(true);
  });
  it("yes는 인용 확인·음식 이름·광고 아님을 모두 만족할 때만", () => {
    const ok = finalizeMine({ verdict: "yes", quote: "감자전이랑 같이 먹었는데 궁합이 정말 좋았어요", reason: "기름진 전과 잘 맞음", ad: false }, { sources: src, foodTerms: ["감자전"] });
    expect(ok.verdict).toBe("yes");
    expect(finalizeMine({ verdict: "yes", quote: "감자전과 먹으면 궁합이 좋다", reason: "", ad: false }, { sources: src, foodTerms: ["감자전"] }).verdict).toBe("unclear");
    expect(finalizeMine({ verdict: "yes", quote: "지평막걸리 한 병 사 와서", reason: "", ad: false }, { sources: src, foodTerms: ["감자전"] }).verdict).toBe("unclear");
    expect(finalizeMine({ ...ok, verdict: "yes", quote: ok.quote!, reason: "", ad: true }, { sources: src, foodTerms: ["감자전"] }).note).toContain("광고");
    expect(finalizeMine({ verdict: "no", quote: "", reason: "", ad: false }, { sources: src, foodTerms: ["감자전"] }).verdict).toBe("no");
  });
});

import { htmlToText } from "../evidence-mine";
describe("htmlToText", () => {
  it("태그를 지우고 문단을 줄로", () => {
    expect(htmlToText("<p>지평막걸리&nbsp;와</p><div>감자전 &amp; 파전</div><script>x()</script>")).toBe("지평막걸리 와\n감자전 & 파전");
  });
});

import { drinkNameVariants, queryPhrases } from "../evidence-mine";
describe("술 이름 변형", () => {
  it("도수 떼기·흔한 낱말 빼기", () => {
    expect(drinkNameVariants("나루 생막걸리 6도")).toEqual(["나루 생막걸리", "나루"]);
    expect(drinkNameVariants("원소주 스피릿")).toEqual(["원소주 스피릿", "원소주"]);
    expect(drinkNameVariants("백련 막걸리 미스티")).toEqual(["백련 막걸리 미스티", "백련 미스티"]);
    expect(drinkNameVariants("막걸리")).toEqual([]);
  });
  it("검색어 따옴표 구절과 이름이 같은 양조장 별칭", () => {
    expect(queryPhrases('"이바비 막걸리" 페어링')).toEqual(["이바비 막걸리"]);
    expect(drinkTermsOf({ name: "이강주", alias: ["이강주"], brewery: "이강주" })).toEqual(["이강주"]);
    expect(drinkTermsOf({ name: "프리미엄 막걸리 이바비", alias: [] }, ['"이바비 막걸리" 안주'])).toContain("이바비 막걸리");
  });
});

import { wellFormed } from "../evidence-mine";
describe("wellFormed", () => {
  it("반으로 잘린 이모지 조각을 지운다", () => {
    const cut = "막걸리🍶".slice(0, 4);
    expect(wellFormed(cut)).toBe("막걸리");
    expect(wellFormed("막걸리🍶")).toBe("막걸리🍶");
  });
});
