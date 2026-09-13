import { describe, expect, it } from "vitest";
import { DATA } from "../../data";
import { categoryOfKind, describeDrink, isGenericKeyword, keywordCore, drinkContextShare, judgeLineup, planPairings, nameStem, isNameVariant, categoryAffinity, calibrateFits, estimateProfile, keywordParams, mainIngredients, matchFoods, profileFit, relativeInterest, shopKeyword } from "../lineup";

describe("쇼핑 검색어", () => {
  it("용량·도수·괄호·세트·끝 숫자를 뗀다", () => {
    expect(shopKeyword("유기농 이도 32")).toBe("유기농 이도");
    expect(shopKeyword("가무치 43도")).toBe("가무치");
    expect(shopKeyword("술예쁘다 생탁주 500ml")).toBe("술예쁘다 생탁주");
    expect(shopKeyword("[한정] 소곡화주 낯꽃 선물세트")).toBe("소곡화주 낯꽃");
    expect(shopKeyword("1932 포천일동막걸리")).toBe("1932 포천일동막걸리");   // 앞 숫자는 이름의 일부
    expect(shopKeyword("화요 41")).toBe("화요");
  });
  it("숫자만 남는 이름은 지우지 않는다", () => {
    expect(shopKeyword("25")).toBe("25");
  });
  it("키워드 묶음은 중복 없이 최대 3개", () => {
    expect(keywordParams("유기농 이도 32")).toEqual(["유기농 이도", "유기농이도", "유기농 이도 32"]);
    expect(keywordParams("메들리아카시아")).toEqual(["메들리아카시아"]);
  });
});

describe("수요 점수 — 기준 키워드 대비", () => {
  const periods = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const pts = (xs: number[]) => xs.map((ratio, i) => ({ period: periods[i], ratio }));
  it("기준과 같으면 100, 절반이면 50", () => {
    const a = pts([10, 10, 10, 10, 10, 10]);
    expect(relativeInterest(a, a, periods).total).toBe(100);
    expect(relativeInterest(pts([5, 5, 5, 5, 5, 5]), a, periods).total).toBe(50);
  });
  it("비어 있는 기간은 0으로 보고 개수를 센다", () => {
    const r = relativeInterest([{ period: "2026-06", ratio: 4 }], pts([10, 10, 10, 10, 10, 10]), periods);
    expect(r.months).toBe(1);
    expect(r.total).toBeCloseTo(6.7, 1);
    expect(r.recent).toBeCloseTo(13.3, 1);
  });
  it("성장률은 기준 대비로 맞춘 뒤 비교 — 명절처럼 전체가 오른 달은 성장으로 치지 않는다", () => {
    const anchor = pts([10, 10, 10, 20, 20, 20]);
    expect(relativeInterest(pts([5, 5, 5, 10, 10, 10]), anchor, periods).growth).toBe(1);
    expect(relativeInterest(pts([5, 5, 5, 20, 20, 20]), anchor, periods).growth).toBe(2);
    expect(relativeInterest(pts([0, 0, 0, 3, 3, 3]), anchor, periods).growth).toBeNull();
  });
  it("기준이 0이면 0", () => {
    expect(relativeInterest(pts([1, 1, 1, 1, 1, 1]), pts([0, 0, 0, 0, 0, 0]), periods).total).toBe(0);
  });
});

describe("종류", () => {
  it("더술닷컴 주종 → 앱 종류", () => {
    expect(categoryOfKind("탁주(고도)")).toBe("탁주");
    expect(categoryOfKind("탁주(저도)")).toBe("탁주");
    expect(categoryOfKind("약주, 청주", "한산소곡주")).toBe("약주");
    expect(categoryOfKind("약주, 청주", "경주법주 청주")).toBe("청주");
    expect(categoryOfKind("증류주", "문경바람 오크")).toBe("증류주");
    expect(categoryOfKind("증류주", "추사 브랜디")).toBe("브랜디");
    expect(categoryOfKind("과실주", "사과와인")).toBe("과실주");
    expect(categoryOfKind("과실주", "허니문 벌꿀주", "벌꿀, 효모")).toBe("허니와인");
    expect(categoryOfKind("리큐르/기타주류", "오미자 리큐르")).toBe("리큐르");
    expect(categoryOfKind("-")).toBeNull();
  });
  it("쌀·누룩 술에 꿀이 조금 들어간 것은 허니와인이 아니다", () => {
    expect(categoryOfKind("리큐르/기타주류", "꿀막걸리 리큐르", "쌀, 누룩, 꿀")).toBe("리큐르");
  });
});

describe("맛 프로필 추정", () => {
  it("스파클링 막걸리는 탄산 5", () => {
    const r = estimateProfile({ category: "탁주", abv: 6, name: "스파클링 막걸리", ingredients: "쌀, 누룩", intro: "탄산이 살아 있는" });
    expect(r.profile.fizz).toBe(5);
    expect(r.flavor).toContain("탄산");
  });
  it("증류주는 도수로 바디, 탄산은 1", () => {
    expect(estimateProfile({ category: "증류주", abv: 45, name: "x", ingredients: "쌀", intro: "" }).profile).toMatchObject({ body: 4, fizz: 1 });
    expect(estimateProfile({ category: "증류주", abv: 22, name: "x", ingredients: "쌀", intro: "" }).profile.body).toBe(2);
  });
  it("감미료가 들어가면 단맛 +1, 드라이 표현이면 −1", () => {
    const base = estimateProfile({ category: "약주", abv: 13, name: "x", ingredients: "쌀, 누룩", intro: "" }).profile.sweet;
    expect(estimateProfile({ category: "약주", abv: 13, name: "x", ingredients: "쌀, 누룩, 아스파탐", intro: "" }).profile.sweet).toBe(base + 1);
    expect(estimateProfile({ category: "약주", abv: 13, name: "x", ingredients: "쌀, 누룩", intro: "드라이한 맛" }).profile.sweet).toBe(base - 1);
  });
  it("값은 늘 1~5, 태그는 1~3개", () => {
    const r = estimateProfile({ category: "허니와인", abv: 12, name: "달콤 스위트 꿀", ingredients: "벌꿀, 설탕, 과당", intro: "달콤한 단맛" });
    for (const v of Object.values(r.profile)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(5); }
    expect(r.flavor.length).toBeGreaterThanOrEqual(1);
    expect(r.flavor.length).toBeLessThanOrEqual(3);
  });
  it("'배합'의 배는 과일로 보지 않는다", () => {
    expect(estimateProfile({ category: "약주", abv: 13, name: "x", ingredients: "쌀, 누룩 배합", intro: "" }).flavor).not.toContain("배향");
    expect(estimateProfile({ category: "과실주", abv: 12, name: "x", ingredients: "배, 효모", intro: "" }).flavor).toContain("배향");
  });
});

describe("설명 문장 — 사실만으로 짓는다", () => {
  it("대표 원료는 물·효모를 빼고 최대 2개, 한 글자 원료는 다른 단어 속에서 잡지 않는다", () => {
    expect(mainIngredients("정제수, 찹쌀(국내산), 누룩, 효모")).toEqual(["찹쌀", "누룩"]);
    expect(mainIngredients("정제수, 증류원액(유기농 쌀, 국내산)")).toEqual([]);   // 괄호 속은 보지 않는다
    expect(mainIngredients("물, 국내산 쌀, 제조용 효모")).toEqual(["쌀"]);
    expect(mainIngredients("정제수, 배, 효모")).toEqual(["배"]);
  });
  it("조사를 받침에 맞춘다", () => {
    expect(describeDrink({ category: "탁주", abv: 13, region: "경기 평택", brewery: "좋은술", ingredients: "쌀, 누룩", flavor: ["진한 바디", "곡물향"] }))
      .toBe("경기 평택 좋은술에서 쌀과 누룩으로 빚은 13도 탁주. 진한 바디·곡물향이 특징입니다.");
    expect(describeDrink({ category: "과실주", abv: 12.5, region: "", brewery: "", ingredients: "사과", flavor: ["사과향"] }))
      .toBe("사과로 빚은 12.5도 과실주. 사과향이 특징입니다.");
    expect(describeDrink({ category: "탁주", abv: 6, region: "", brewery: "", ingredients: "쌀", flavor: ["달콤", "가벼움"] }))
      .toBe("쌀로 빚은 6도 탁주. 달콤한 맛·가벼운 바디가 특징입니다.");   // ㄹ받침은 '로', 형용사 태그는 명사구로
    expect(describeDrink({ category: "리큐르", abv: 20, region: "", brewery: "", ingredients: "매실, 누룩", flavor: [] }))
      .toBe("매실과 누룩으로 빚은 20도 리큐르.");
  });
});

describe("추천 음식 이름 찾기", () => {
  const foods = DATA.foods.map((f) => ({ id: f.id, name: f.name, alias: f.alias }));
  const nameOf = (id: string) => DATA.foods.find((f) => f.id === id)!.name;
  it("양조장 추천 문장에서 카탈로그 음식을 찾는다", () => {
    expect(matchFoods("닭강정, 통돼지보쌈와 잘 어울린다.", foods).map(nameOf).sort()).toEqual(["닭강정", "보쌈"].sort());
  });
  it("긴 이름을 먼저 잡아 짧은 이름이 겹쳐 잡히지 않는다 — 해물파전 속 '파전' 별칭", () => {
    const ids = matchFoods("해물파전과 함께", foods).map(nameOf);
    expect(ids).toEqual(["해물파전"]);
  });
  it("일반적인 말만 있으면 찾지 않는다", () => {
    expect(matchFoods("한식과 매우 잘 어울린다", foods)).toEqual([]);
  });
});

describe("맛 궁합 계산", () => {
  const sparkling = { sweet: 3, acid: 4, body: 3, fizz: 5, aroma: 3 };
  const soju = { sweet: 1, acid: 1, body: 4, fizz: 1, aroma: 3 };
  it("기름진 음식엔 산미·탄산이, 진한 음식엔 높은 도수가 이유로 붙는다", () => {
    const chicken = { fat: 4, spice: 1, umami: 3, salt: 3, sweet: 1, weight: 3 };
    expect(profileFit(sparkling, 6, chicken).plus).toContain("산미 4·탄산 5점이 기름기 4점을 씻어냄");
    expect(profileFit(soju, 40, chicken).plus).toContain("도수 40%가 진한 기름기·무게를 정리");
  });
  it("높은 도수 × 가벼운 음식, 드라이 × 디저트는 감점", () => {
    const light = { fat: 1, spice: 1, umami: 2, salt: 2, sweet: 2, weight: 1 };
    const cake = { fat: 3, spice: 1, umami: 1, salt: 1, sweet: 5, weight: 2 };
    expect(profileFit(soju, 40, light).minus).toContain("높은 도수가 가벼운 음식을 압도");
    expect(profileFit(soju, 40, cake).minus).toContain("드라이한 술이 디저트 옆에서 시고 쓰게 느껴짐");
    expect(profileFit(soju, 40, light).s).toBeLessThan(profileFit(soju, 40, { fat: 4, spice: 1, umami: 3, salt: 3, sweet: 1, weight: 4 }).s);
  });
  it("점수는 0~100", () => {
    for (const f of DATA.foods) {
      if (!f.profile) continue;
      const s = profileFit(soju, 45, f.profile).s;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
  it("기존 조합의 이유 문구와 대체로 일치한다(술마다 늘린 점수는 달라도 이유는 같은 규칙)", () => {
    const D = new Map(DATA.drinks.map((d) => [d.id, d]));
    const F = new Map(DATA.foods.map((f) => [f.id, f]));
    const norm = (s: string) => s.replace(/\d+(\.\d+)?/g, "#");
    let same = 0, n = 0;
    for (const p of DATA.pairings) {
      const d = D.get(p.d), f = F.get(p.f);
      if (!p.pf || !d?.profile || !f?.profile) continue;
      const fit = profileFit(d.profile, d.abv ?? null, f.profile);
      const want = new Set([...p.pf.plus, ...p.pf.minus].map(norm));
      const got = new Set([...fit.plus, ...fit.minus].map(norm));
      n++;
      if ([...want].every((w) => got.has(w))) same++;
    }
    expect(n).toBeGreaterThan(800);
    expect(same / n).toBeGreaterThan(0.6);
  });
});

describe("흔한 이름", () => {
  const places = ["포천", "안동", "한산", "문경", "경주"];
  it("흔한 말·원료·지명뿐이면 흔한 이름", () => {
    expect(isGenericKeyword("생막걸리")).toBe(true);
    expect(isGenericKeyword("사과와인")).toBe(true);
    expect(isGenericKeyword("포천막걸리", places)).toBe(true);
    expect(isGenericKeyword("안동소주", places)).toBe(true);
    expect(isGenericKeyword("프리미엄 유기농 막걸리")).toBe(true);
    expect(isGenericKeyword("삼해주")).toBe(true);           // 여러 양조장이 파는 술 종류 이름
    expect(isGenericKeyword("금산인삼주", ["금산"])).toBe(true);
  });
  it("브랜드 말이 남으면 제품 이름", () => {
    expect(isGenericKeyword("술예쁘다 생탁주")).toBe(false);
    expect(isGenericKeyword("문경바람", places)).toBe(false);
    expect(isGenericKeyword("소곡화주 낯꽃", places)).toBe(false);
    expect(isGenericKeyword("도깨비술")).toBe(false);
  });
  it("브랜드 부분만 떼어 볼 수 있다 — 한 글자 브랜드(원소주)는 원래 이름도 함께 검색", () => {
    expect(keywordCore("원소주")).toBe("원");
    expect(keywordCore("생막걸리")).toBe("");
  });
});

describe("이름이 술 이야기로 쓰이는가", () => {
  it("과일·관용구로 쓰인 글은 술 이야기로 치지 않는다", () => {
    const r = drinkContextShare(["홍시 맛있게 먹는 법", "대봉 <b>홍시</b> 10kg 주문", "홍시로 빚은 과실주 시음 후기"], "홍시");
    expect(r).toEqual({ share: 0.33, hits: 3 });
  });
  it("이름 속 '술'은 맥락으로 치지 않는다", () => {
    expect(drinkContextShare(["대나무술 공예 체험"], "대나무술").share).toBe(0);
    expect(drinkContextShare(["대나무술 한잔, 안주는 두부김치"], "대나무술").share).toBe(1);
  });
  it("이름이 들어간 글이 없으면 null", () => {
    expect(drinkContextShare(["전혀 다른 글"], "도깨비술")).toEqual({ share: null, hits: 0 });
  });
});

describe("같은 제품의 다른 표기", () => {
  it("종류 말·수식어·도수를 떼고 비교", () => {
    expect(nameStem("해창 생막걸리")).toBe("해창");
    expect(nameStem("문배술")).toBe("문배");
    expect(isNameVariant("문배술", "문배주")).toBe(true);
    expect(isNameVariant("해창 생막걸리", "해창막걸리 12도")).toBe(true);
    expect(isNameVariant("김포예주", "김포예주 프리미엄")).toBe(true);
  });
  it("앞 두 글자만 같은 다른 제품은 구분", () => {
    expect(isNameVariant("오미로제 연", "오미자생술")).toBe(false);
    expect(isNameVariant("고운달 오크", "고운달 백자")).toBe(true);   // 줄기 '고운달'이 60% 넘게 겹침 → 같은 계열로 본다
  });
});

describe("선정", () => {
  const base = { key: "k", keyword: "술예쁘다", brewery: "좋은술", category: "탁주" as const, abv: 13, interest: { total: 50, recent: 50, months: 12, growth: 1 }, blog: { hits: 30, share: 0.9 } };
  it("수요·기간·블로그 확인을 모두 통과해야 선정", () => {
    expect(judgeLineup([base])[0]).toMatchObject({ selected: true, reason: "선정" });
    expect(judgeLineup([{ ...base, interest: { ...base.interest, total: 10 } }])[0].reason).toContain("쇼핑 수요 낮음");
    expect(judgeLineup([{ ...base, interest: { ...base.interest, months: 3 } }])[0].reason).toContain("3개월만");
    expect(judgeLineup([{ ...base, blog: { hits: 40, share: 0.1 } }])[0].reason).toContain("술 이야기로 확인 안 됨");
    expect(judgeLineup([{ ...base, blog: null }])[0].selected).toBe(false);
  });
  it("이름에 술 단어가 있으면 블로그 기준을 조금 낮춘다", () => {
    expect(judgeLineup([{ ...base, keyword: "송이주", blog: { hits: 40, share: 0.5 } }])[0].selected).toBe(true);
    expect(judgeLineup([{ ...base, keyword: "게이샤", blog: { hits: 40, share: 0.5 } }])[0].selected).toBe(false);
  });
  it("라인업 변형·중복 이름·양조장 이름은 제외", () => {
    expect(judgeLineup([{ ...base, variantOfCatalog: true }])[0].reason).toBe("현재 라인업 제품의 다른 표기");
    expect(judgeLineup([{ ...base, duplicateKeyword: true }])[0].selected).toBe(false);
    expect(judgeLineup([{ ...base, breweryName: true }])[0].selected).toBe(false);
  });
  it("먼저 뽑힌 제품의 다른 표기는 제외", () => {
    const j = judgeLineup([{ ...base, key: "a", keyword: "김포예주" }, { ...base, key: "b", keyword: "김포예주 프리미엄", interest: { ...base.interest, total: 30 } }]);
    expect(j.map((x) => x.selected)).toEqual([true, false]);
    expect(j[1].reason).toContain("김포예주");
  });
  it("양조장당 3종까지, 수요 큰 순서로", () => {
    const rows = [10, 90, 50, 70].map((t, i) => ({ ...base, key: `k${i}`, keyword: ["가나다", "라마바", "사아자", "차카타"][i], interest: { ...base.interest, total: 20 + t } }));
    const j = judgeLineup(rows);
    expect(j.map((x) => x.interest.total)).toEqual([110, 90, 70, 30]);
    expect(j.map((x) => x.selected)).toEqual([true, true, true, false]);
  });
});

describe("새 술의 페어링", () => {
  const foods = DATA.foods.map((f) => ({ id: f.id, name: f.name, category: f.category, profile: f.profile, trend: f.trend }));
  const makgeolli = { profile: { sweet: 3, acid: 4, body: 3, fizz: 5, aroma: 3 }, abv: 6 };
  it("양조장 추천이 먼저 official 90, 나머지는 맛 궁합으로 채워 총 8개", () => {
    const off = [DATA.foods.find((f) => f.name === "닭강정")!.id];
    const p = planPairings(makgeolli, foods, off);
    expect(p).toHaveLength(8);
    expect(p[0]).toMatchObject({ f: off[0], src: "official", es: 90 });
    expect(p.slice(1).every((x) => x.src === "profile" && x.es >= 84 && x.es <= 87)).toBe(true);
    expect(new Set(p.map((x) => x.f)).size).toBe(8);
  });
  it("여러 술을 만들 때 이미 많이 쓴 음식은 같은 점수에서 뒤로 — 쏠림 방지", () => {
    const usage = new Map<string, number>();
    const a = planPairings(makgeolli, foods, [], undefined, usage).map((x) => x.f);
    const b = planPairings(makgeolli, foods, [], undefined, usage).map((x) => x.f);
    expect(a.filter((f) => b.includes(f)).length).toBeLessThan(8);
  });
  it("맛 궁합 조합은 감점 이유가 없고, 같은 분류는 2개까지", () => {
    const p = planPairings({ profile: { sweet: 4, acid: 2, body: 2, fizz: 1, aroma: 4 }, abv: 12 }, foods, []);
    expect(p.every((x) => x.pf.minus.length === 0)).toBe(true);
    const cat = new Map<string, number>();
    for (const x of p) { const c = foods.find((f) => f.id === x.f)!.category; cat.set(c, (cat.get(c) ?? 0) + 1); }
    expect(Math.max(...cat.values())).toBeLessThanOrEqual(2);
  });
});

describe("종류 친화도", () => {
  it("같은 종류 술의 근거 조합만 세고, 맛 프로필 조합은 세지 않는다", () => {
    const drinks = [{ id: "a", category: "과실주" }, { id: "b", category: "과실주" }, { id: "c", category: "과실주" }, { id: "z", category: "증류주" }];
    const pairs = [{ d: "a", f: "cheese", src: "official" }, { d: "b", f: "cheese", src: "blog" }, { d: "c", f: "steak", src: "media" }, { d: "c", f: "pizza", src: "profile" }, { d: "z", f: "pork", src: "official" }];
    const af = categoryAffinity(pairs, drinks, "과실주");
    expect(af.label).toBe("과실주");
    expect([...af.counts.entries()]).toEqual([["cheese", 2], ["steak", 1]]);
  });
  it("근거 있는 술이 적은 종류는 전체 기준으로 대신", () => {
    const af = categoryAffinity([{ d: "z", f: "pork", src: "official" }], [{ id: "z", category: "브랜디" }], "브랜디");
    expect(af.label).toBe("전통주");
  });
  it("친화도가 높은 음식이 맛 분석 앞자리에 오고 이유에 횟수를 적는다", () => {
    const foods = DATA.foods.map((f) => ({ id: f.id, name: f.name, category: f.category, profile: f.profile, trend: f.trend }));
    const af = categoryAffinity(DATA.pairings, DATA.drinks, "과실주");
    const top = [...af.counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const wine = { profile: { sweet: 2, acid: 4, body: 3, fizz: 1, aroma: 4 }, abv: 12 };
    const p = planPairings(wine, foods, [], undefined, undefined, af);
    const fit = profileFit(wine.profile, 12, DATA.foods.find((f) => f.id === top)!.profile!);
    if (fit.minus.length === 0) {
      expect(p[0].f).toBe(top);
      expect(p[0].reason).toContain("과실주");
    }
    expect(p.every((x) => x.reason.includes("맛 분석"))).toBe(true);
  });
});

describe("맛 궁합 백분위", () => {
  it("같은 값은 같은 백분위, 순서 유지", () => {
    expect(calibrateFits([10, 20, 20, 30])).toEqual([13, 50, 50, 88]);
    expect(calibrateFits([5])).toEqual([50]);
    expect(calibrateFits([])).toEqual([]);
  });
});
