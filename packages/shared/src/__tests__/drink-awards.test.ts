import { describe, expect, it } from "vitest";
import {
  awardYearCount, awardYears, drinkAwardString, matchAwardDrink, mergeDrinkAwards, normAwardPart, parseDrinkAward, prizeRank, sameBrewery, type AwardDrink,
} from "../drink-awards";

describe("수상 문자열", () => {
  it("우리술품평회·대한민국주류대상을 같은 형식으로 쓴다", () => {
    expect(drinkAwardString({ competition: "우리술품평회", year: 2025, part: "과실주", prize: "대상" })).toBe("2025 우리술품평회 과실주 대상");
    expect(drinkAwardString({ competition: "우리술품평회", year: 2026, part: "과실주", prize: "대상·대통령상" })).toBe("2026 우리술품평회 과실주 대통령상");
    expect(drinkAwardString({ competition: "대한민국주류대상", year: 2026, part: "탁주", prize: "Best of Best" })).toBe("2026 대한민국주류대상 탁주 Best of Best");
    expect(drinkAwardString({ competition: "대한민국주류대상", year: 2024, part: "약주·청주", prize: "대상" })).toBe("2024 대한민국주류대상 약·청주 대상");
  });

  it("부문 이름을 맞춘다", () => {
    expect(normAwardPart("약주·청주")).toBe("약·청주");
    expect(normAwardPart("약청주")).toBe("약·청주");
    expect(normAwardPart("탁주부문")).toBe("탁주");
    expect(normAwardPart("증류주 부문")).toBe("증류주");
    expect(normAwardPart("한국와인")).toBe("한국와인");
  });

  it("예전 표기까지 읽는다", () => {
    expect(parseDrinkAward("2025 우리술품평회 과실주 대상")).toEqual({ competition: "우리술품평회", year: 2025, part: "과실주", prize: "대상" });
    expect(parseDrinkAward("2026 우리술품평회 대통령상")).toEqual({ competition: "우리술품평회", year: 2026, part: "", prize: "대통령상" });
    expect(parseDrinkAward("2015 대한민국 우리술품평회 과실주 대상")).toMatchObject({ competition: "우리술품평회", year: 2015, part: "과실주" });
    expect(parseDrinkAward("2016년 우리술품평회 최우수상")).toMatchObject({ year: 2016, prize: "최우수상", part: "" });
    expect(parseDrinkAward("2019 우리술품평회 탁주부문 대상")).toMatchObject({ part: "탁주", prize: "대상" });
    expect(parseDrinkAward("2026 대한민국주류대상 탁주 Best of Best")).toEqual({ competition: "대한민국주류대상", year: 2026, part: "탁주", prize: "Best of Best" });
    expect(parseDrinkAward("2019 대한민국 우리술 대축제 1위")).toBeNull();
    expect(parseDrinkAward("2008 SWSC 동상")).toBeNull();
  });

  it("등급 순서 — 대통령상·Best of Best가 맨 앞", () => {
    expect(prizeRank("대통령상")).toBe(0);
    expect(prizeRank("Best of Best")).toBe(0);
    expect(prizeRank("대상")).toBeLessThan(prizeRank("최우수상"));
    expect(prizeRank("우수상")).toBeLessThan(prizeRank("장려상"));
  });

  it("최근 N개 연도 — 가장 최근 연도부터 거꾸로, 빈 연도도 칸을 둔다", () => {
    expect(awardYears([2026, 2024, 2019], 5)).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(awardYears([], 5)).toEqual([]);
  });

  it("대회마다 다루는 연도 수 — 우리술품평회 5년, 대한민국주류대상 3년", () => {
    expect(awardYearCount("우리술품평회")).toBe(5);
    expect(awardYearCount("대한민국주류대상")).toBe(3);
    expect(awardYears([2026, 2025, 2024, 2023], awardYearCount("대한민국주류대상"))).toEqual([2026, 2025, 2024]);
  });
});

describe("수상 합치기", () => {
  it("같은 대회·연도의 예전 표기는 새 표기로 바꾸고, 다른 수상은 둔다", () => {
    const out = mergeDrinkAwards(
      ["2026 우리술품평회 대통령상", "2016년 우리술품평회 최우수상", "2008 SWSC 동상"],
      [{ competition: "우리술품평회", year: 2026, part: "과실주", prize: "대상·대통령상" }, { competition: "대한민국주류대상", year: 2025, part: "한국와인", prize: "대상" }],
    );
    expect(out).toEqual(["2026 우리술품평회 과실주 대통령상", "2025 대한민국주류대상 한국와인 대상", "2016년 우리술품평회 최우수상", "2008 SWSC 동상"]);
  });
  it("이미 같은 문자열이면 그대로", () => {
    expect(mergeDrinkAwards(["2025 우리술품평회 과실주 대상"], [{ competition: "우리술품평회", year: 2025, part: "과실주", prize: "대상" }])).toEqual(["2025 우리술품평회 과실주 대상"]);
  });
});

describe("수상작 ↔ 카탈로그 술", () => {
  const drinks: AwardDrink[] = [
    { id: "d1", name: "청명주", alias: ["청명주", "중원당"], brewery: "중원당", abv: 17 },
    { id: "d2", name: "가무치소주 25도", alias: ["가무치소주 25도", "다농바이오"], brewery: "다농바이오", abv: 25 },
    { id: "d3", name: "이도 42", alias: ["이도42"], brewery: "조은술세종", abv: 42 },
    { id: "d4", name: "딸기막걸리", alias: [], brewery: "성수주조장", abv: 6 },
    { id: "d5", name: "감싸주는 날", alias: ["감싸주는날", "두레박", "한증류소"], brewery: "한증류소", abv: 16 },
    { id: "d6", name: "술아원 필 40", alias: ["필40", "술아원"], brewery: "술아원", abv: 40 },
    { id: "d7", name: "경성과하주", alias: ["경성과하주", "술아원"], brewery: "술아원", abv: 23 },
  ];
  it("양조장 법인 표기가 달라도 같은 양조장", () => {
    expect(sameBrewery("농업회사법인 주식회사 다농바이오", "다농바이오")).toBe(true);
    expect(sameBrewery("농업회사법인 (유)친구들의술 지란지교", "지란지교")).toBe(true);
    expect(sameBrewery("중원당", "술아원")).toBe(false);
    expect(sameBrewery("양주골이가전통주", "(주)양주도가 농업회사법인")).toBe(false);   // 두 글자 핵심어 "양주"만 겹침
    expect(sameBrewery("풍정사계 화양", "농업회사법인 유한회사 화양")).toBe(true);    // 띄어 쓴 낱말이 이름 전체
  });
  it("양조장 이름이 든 제품 별칭도 제품 이름으로 본다", () => {
    const list: AwardDrink[] = [{ id: "d88", name: "지란지교 프리미엄 약주", alias: ["지란지교 약주", "친구들의 술 지란지교"], brewery: "친구들의 술 지란지교", abv: 15 }];
    expect(matchAwardDrink({ name: "지란지교 약주", brewery: "지란지교" }, list)).toBe("d88");
  });
  it("이름이 같고 양조장이 같으면", () => {
    expect(matchAwardDrink({ name: "청명주", brewery: "중원당" }, drinks)).toBe("d1");
    expect(matchAwardDrink({ name: "이도42", brewery: "농업회사법인 조은술세종 주식회사" }, drinks)).toBe("d3");
  });
  it("도수 표기·양조장 이름이 붙은 이름도", () => {
    expect(matchAwardDrink({ name: "가무치소주 25", brewery: "다농바이오" }, drinks)).toBe("d2");
    expect(matchAwardDrink({ name: "중원당 청명주", brewery: "중원당" }, drinks)).toBe("d1");
    expect(matchAwardDrink({ name: "필40", brewery: "농업회사법인 술아원" }, drinks)).toBe("d6");
  });
  it("이름이 같아도 양조장이 다르면 다른 술", () => {
    expect(matchAwardDrink({ name: "딸기막걸리", brewery: "청산녹수" }, drinks)).toBeNull();
  });
  it("종류·도수가 다른 변형은 붙이지 않는다", () => {
    expect(matchAwardDrink({ name: "청명주 탁주", brewery: "중원당" }, drinks)).toBeNull();
    expect(matchAwardDrink({ name: "가무치소주 43도", brewery: "다농바이오" }, drinks)).toBeNull();
  });
  it("양조장 이름만 겹치는 다른 제품에 붙지 않는다", () => {
    expect(matchAwardDrink({ name: "술아원 쌀막걸리", brewery: "술아원" }, drinks)).toBeNull();
  });
  it("옛 양조장 이름(별칭)도 같은 양조장", () => {
    expect(matchAwardDrink({ name: "감싸주는날", brewery: "농업회사법인 주식회사 두레박" }, drinks)).toBe("d5");
  });
});

describe("이름이 같은 제품은 도수로 가린다", () => {
  const list: AwardDrink[] = [
    { id: "d342", name: "도한 청명주 15", alias: [], brewery: "한영석의발효연구소", abv: 15 },
    { id: "d490", name: "도한 청명주", alias: [], brewery: "한영석의발효연구소", abv: 13.8 },
  ];
  it("도수가 맞는 쪽에 붙는다", () => {
    expect(matchAwardDrink({ name: "도한 청명주", brewery: "농업회사법인(주)한영석의발효연구소", abv: 13.8 }, list)).toBe("d490");
    expect(matchAwardDrink({ name: "도한 청명주 15", brewery: "한영석의발효연구소", abv: 15 }, list)).toBe("d342");
  });
  it("도수를 몰라도 이름이 완전히 같은 쪽이 먼저", () => {
    expect(matchAwardDrink({ name: "도한 청명주", brewery: "한영석의발효연구소" }, list)).toBe("d490");
  });
  it("이름이 어느 쪽과도 완전히 같지 않고 도수도 모르면 붙이지 않는다", () => {
    expect(matchAwardDrink({ name: "한영석 도한 청명주", brewery: "한영석의발효연구소" }, list)).toBeNull();
  });
});
