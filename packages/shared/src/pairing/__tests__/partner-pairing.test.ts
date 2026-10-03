import { describe, expect, it } from "vitest";
import { applyPartnerPairing, foodCategoryOf, foodSimilarity, partnerEvidence, partnerPairingProblem, resolveDrinkText, resolveFoodText } from "../partner-pairing";
import { evidenceStats } from "../confidence";

const foods = [
  { id: "f08", name: "해물파전", alias: ["파전", "동래파전", "전", "부침개"], category: "전" },
  { id: "f09", name: "김치전", alias: [], category: "전" },
  { id: "f48", name: "육포", alias: [], category: "마른안주" },
  { id: "f20", name: "육회", alias: ["육사시미"], category: "회" },
];
const drinks = [{ id: "d11", name: "한산소곡주" }, { id: "d2", name: "화요" }];

describe("음식 글자 → 카탈로그 연결", () => {
  it("이름·별칭 똑같음, 괄호·띄어쓰기 무시", () => {
    expect(resolveFoodText("해물파전(대)", foods)).toMatchObject({ id: "f08", how: "exact" });
    expect(resolveFoodText("동래 파전", foods)).toMatchObject({ id: "f08", how: "exact" });
    expect(resolveFoodText("육 사시미", foods)).toMatchObject({ id: "f20", how: "exact" });
  });
  it("카탈로그 이름이 글자 안에 있으면 가장 긴 것, 1자 별칭·별칭 포함은 보지 않음", () => {
    expect(resolveFoodText("수제 육포", foods)).toMatchObject({ id: "f48", how: "contains" });
    expect(resolveFoodText("묵은지 김치전", foods)).toMatchObject({ id: "f09" });
    expect(resolveFoodText("전", foods)).toBeNull();
    expect(resolveFoodText("김치파전", foods)).toBeNull();
    expect(resolveFoodText("도토리묵 무침", foods)).toBeNull();
  });
  it("술 글자 연결 — 똑같거나 3자 이상 이름 포함", () => {
    expect(resolveDrinkText("한산소곡주 700ml", drinks)?.id).toBe("d11");
    expect(resolveDrinkText("화요", drinks)?.id).toBe("d2");
    expect(resolveDrinkText("화요 25 하이볼", drinks)).toBeNull();
  });
});

describe("비슷한 음식", () => {
  it("같은 음식 > 글자 포함 > 같은 분류", () => {
    expect(foodSimilarity({ text: "해물파전", id: "f08" }, { text: "해물파전(대)", id: "f08" })).toBe("exact");
    expect(foodSimilarity({ text: "육포" }, { text: "수제 육포" })).toBe("text");
    expect(foodSimilarity({ text: "파전", category: "전" }, { text: "김치전", id: "f09", category: "전" })).toBe("similar");
    expect(foodSimilarity({ text: "육회", category: "회" }, { text: "김치전", category: "전" })).toBeNull();
  });
  it("분류 짐작 — 연결되면 그 분류, 아니면 분류 낱말", () => {
    expect(foodCategoryOf("묵은지 김치전", foods)).toBe("전");
    expect(foodCategoryOf("소고기 숯불구이", foods)).toBe("구이");
    expect(foodCategoryOf("도토리묵", foods)).toBeNull();
  });
});

describe("파트너 페어링 검사·근거", () => {
  const base = { foodText: "해물파전", note: "", countForDrink: 0, countTotal: 0 };
  it("양조장은 술 id, 식당은 술 글자", () => {
    expect(partnerPairingProblem({ ...base, kind: "brewery", drinkId: "d11" })).toBeNull();
    expect(partnerPairingProblem({ ...base, kind: "brewery", drinkId: "" })).toContain("술");
    expect(partnerPairingProblem({ ...base, kind: "restaurant", drinkText: "" })).toContain("술");
    expect(partnerPairingProblem({ ...base, kind: "restaurant", drinkText: "하우스 막걸리" })).toBeNull();
    expect(partnerPairingProblem({ ...base, kind: "restaurant", drinkText: "a", foodText: "" })).toContain("음식");
    expect(partnerPairingProblem({ ...base, kind: "restaurant", drinkText: "a", countTotal: 40 })).toContain("40");
    expect(partnerPairingProblem({ ...base, kind: "brewery", drinkId: "d11", countForDrink: 8 })).toContain("8");
    expect(partnerPairingProblem({ ...base, kind: "brewery", drinkId: "d11", note: "www.x.com" })).toContain("링크");
  });
  it("양조장 '제공'·식당 '추천' 근거는 서로 다른 출처(official 1.0씩)", () => {
    const a = partnerEvidence("한증류소", "", "brewery"), b = partnerEvidence("유록", "", "restaurant");
    expect(a.source).toBe("한증류소 제공");
    expect(b.source).toBe("유록 추천");
    expect(evidenceStats([a, b], "official")).toEqual({ n: 2, e: 2 });
    expect(applyPartnerPairing(null, "", "유록")).toMatchObject({ tier: "official", es: 90, reason: "유록이 직접 추천한 조합입니다." });
  });
});

describe("빠른 입력 추천(2026-10-03)", async () => {
  const { suggestPairings } = await import("../partner-pairing");
  it("근거 등급 → 맛 분석 점수 순, 이미 적은 음식·중복 제외, 이유는 첫 문장", () => {
    const rows = [
      { foodId: "f1", food: "해물파전", src: "profile", s: 70, reason: "기름진 전을 산미가 씻어 줘요. 두 번째 문장." },
      { foodId: "f2", food: "육회", src: "blog", s: 40, reason: "" },
      { foodId: "f3", food: "족발", src: "official", s: 30, reason: "양조장이 권하는 조합" },
      { foodId: "f4", food: "삼겹살", src: "profile", s: 80, reason: null },
      { foodId: "f1", food: "해물파전", src: "media", s: 10, reason: "x" },
      { foodId: "f5", food: "피자", src: "profile", s: 90, reason: "y" },
    ];
    const r = suggestPairings(rows, new Set(["f5"]), 4);
    expect(r.map((x) => `${x.food}:${x.label}`)).toEqual(["족발:양조장 공식", "해물파전:매체 소개", "육회:블로그 후기", "삼겹살:맛 분석 추정"]);
    expect(r[0].note).toBe("양조장이 권하는 조합"); expect(r[3].note).toBe("");
    const est = suggestPairings([{ foodId: "f1", food: "a", src: "profile", s: 1, reason: "기름진 전을 산미가 씻어 줘요. 두 번째 문장." }])[0];
    expect(est.note).toBe(""); expect(est.hint).toBe("기름진 전을 산미가 씻어 줘요.");   // 추정은 이유 빈칸, 분석 문장은 참고
  });
});
