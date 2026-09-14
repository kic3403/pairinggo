import { describe, expect, it } from "vitest";
import { cardSummary, profileAxes, profileLine } from "../summary";

const drink = { sweet: 4, acid: 2, body: 3, fizz: 1, aroma: 3 };
const food = { fat: 2, spice: 4, umami: 3, salt: 3, sweet: 2, weight: 3 };

describe("페어링 카드 요약(라벨 줄)", () => {
  it("맛 프로필 줄 — 술은 바디·산미·단맛·탄산·향, 음식은 무게·기름기·매운맛·감칠맛·짠맛·단맛을 '이름 N' 형식으로", () => {
    expect(profileLine("drink", drink)).toBe("바디 3 · 산미 2 · 단맛 4 · 탄산 1 · 향 3");
    expect(profileLine("food", food)).toBe("무게 3 · 기름기 2 · 매운맛 4 · 감칠맛 3 · 짠맛 3 · 단맛 2");
    expect(profileLine("drink", undefined)).toBeNull();
  });
  it("페어링 포인트는 맛 궁합 plus, 주의는 minus. '점' 표기는 떼고 화살표 균형 문구는 읽기 쉽게 바꾼다", () => {
    const s = cardSummary({ pf: { s: 60, plus: ["바디 3점 ↔ 무게 3점 균형", "단맛 4점이 매운맛 4점을 감싸줌"], minus: ["드라이한 술이 단 양념 옆에서 밋밋해짐"] }, reason: "긴 설명" });
    expect(s.points).toEqual(["바디 3과 무게 3이 균형", "단맛 4가 매운맛 4를 감싸줌"]);
    expect(cardSummary({ pf: { s: 1, plus: ["바디 2점 ↔ 무게 4점 균형", "산미 4·탄산 5점이 기름기 4점을 씻어냄"], minus: ["바디 5점과 음식 무게 2점 차이가 큼"] } }).points).toEqual(["바디 2와 무게 4가 균형", "산미 4·탄산 5가 기름기 4를 씻어냄"]);
    expect(cardSummary({ pf: { s: 1, plus: [], minus: ["바디 5점과 음식 무게 2점 차이가 큼"] } }).cautions).toEqual(["바디 5와 음식 무게 2 차이가 큼"]);
    expect(s.cautions).toEqual(["드라이한 술이 단 양념 옆에서 밋밋해짐"]);
  });
  it("맛 프로필 축 — 막대용 값은 0~5로 자르고, 프로필이 없으면 빈 목록", () => {
    expect(profileAxes("drink", drink).map((a) => `${a.label}${a.value}`)).toEqual(["바디3", "산미2", "단맛4", "탄산1", "향3"]);
    expect(profileAxes("food", { ...food, spice: 9 }).find((a) => a.key === "spice")?.value).toBe(5);
    expect(profileAxes("food", undefined)).toEqual([]);
  });
  it("맛 궁합 정보가 없으면 포인트 없이 설명만", () => {
    const s = cardSummary({ reason: "설명" });
    expect(s.points).toEqual([]);
    expect(s.cautions).toEqual([]);
  });
});
