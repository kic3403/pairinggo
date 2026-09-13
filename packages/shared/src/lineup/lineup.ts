/**
 * 전통주 라인업 확장 규칙 (2026-09-13) — 네이버 쇼핑인사이트로 수요를 재고, 공개 제품 정보로 새 술 항목을 만든다.
 *
 * 왜 쇼핑인사이트인가: 네이버 쇼핑 검색 API(상품 목록)는 2026-07-31 종료됐고, 스마트스토어 페이지를 자동으로 긁는 것은 약관 위반이다.
 * 쇼핑인사이트(카테고리 안 키워드 클릭 추이)는 NAVER API HUB에 남아 있고, 스마트스토어를 포함한 네이버 쇼핑 전체 클릭을 반영한다.
 * 한 번에 키워드 5개까지 상대값(최댓값 100)만 주므로, 매 요청에 같은 기준 키워드를 넣어 기준 대비 배율로 바꾼다.
 *
 * 제품 사실(이름·양조장·도수·원료·지역)은 더술닷컴 등 공개 정보에서 가져오되, 설명 문장은 원문을 쓰지 않고 여기서 새로 만든다(공공누리 4유형 — 변경 금지).
 */
import type { DrinkProfile, FoodProfile } from "../types";
import { DRINK_CONTEXT } from "../trend";

/* ---------- 1. 쇼핑 검색어 ---------- */

/** 제품명 → 쇼핑 검색어. 용량·도수·괄호·세트 표기와 끝의 숫자(도수 표기)를 뗀다. "유기농 이도 32" → "유기농 이도" */
export function shopKeyword(name: string): string {
  let s = (name || "")
    .replace(/[\[(（【].*?[\])）】]/g, " ")
    .replace(/\d+(\.\d+)?\s*(ml|mL|ML|l|L|리터)\b/g, " ")
    .replace(/\d+(\.\d+)?\s*(%|도)(?=\s|$)/g, " ")
    .replace(/선물\s*세트|세트|기프트|패키지/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const noTail = s.replace(/\s+\d+(\.\d+)?$/, "").trim();
  if (noTail.replace(/\s/g, "").length >= 2) s = noTail;
  return s;
}

/** 쇼핑인사이트 키워드 묶음(최대 3개) — 검색어, 띄어쓰기 없앤 형태, 원래 이름 */
export function keywordParams(name: string): string[] {
  const k = shopKeyword(name);
  const out = [k, k.replace(/\s+/g, ""), (name || "").replace(/\s+/g, " ").trim()].filter((x) => x.replace(/\s/g, "").length >= 2);
  return [...new Set(out)].slice(0, 3);
}

/* ---------- 2. 수요 점수 ---------- */

export type InsightPoint = { period: string; ratio: number };
export type Interest = {
  /** 기간 전체 클릭량, 기준 키워드 = 100 */
  total: number;
  /** 최근 3개 기간, 기준 = 100 */
  recent: number;
  /** 값이 잡힌 기간 수(검색량이 너무 적으면 네이버가 비운다) */
  months: number;
  /** 최근 3개 기간 평균 ÷ 그 이전 평균 (이전이 0이면 null) */
  growth: number | null;
};

/** 후보·기준 키워드의 기간별 상대값 → 기준 대비 배율. periods는 조회 기간 전체(오름차순) */
export function relativeInterest(cand: InsightPoint[], anchor: InsightPoint[], periods: string[]): Interest {
  const at = (pts: InsightPoint[]) => { const m = new Map(pts.map((p) => [p.period, p.ratio])); return periods.map((p) => m.get(p) ?? 0); };
  const c = at(cand), a = at(anchor);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const ratio = (x: number, y: number) => (y > 0 ? Math.round((x / y) * 1000) / 10 : 0);
  const k = Math.min(3, periods.length);
  const cr = c.slice(-k), ar = a.slice(-k), cp = c.slice(0, -k), ap = a.slice(0, -k);
  // 기준 대비로 맞춘 뒤 비교해야 계절 효과(명절 등)가 기준과 함께 빠진다
  const recentRel = sum(ar) > 0 ? sum(cr) / sum(ar) : 0;
  const prevRel = sum(ap) > 0 ? sum(cp) / sum(ap) : 0;
  return {
    total: ratio(sum(c), sum(a)),
    recent: ratio(sum(cr), sum(ar)),
    months: c.filter((x) => x > 0).length,
    growth: prevRel > 0 ? Math.round((recentRel / prevRel) * 100) / 100 : null,
  };
}

/* ---------- 3. 종류 ---------- */

export type LineupCategory = "탁주" | "약주" | "청주" | "증류주" | "과실주" | "허니와인" | "리큐르" | "브랜디";
const HONEY = /벌꿀|꿀술|허니|미드|mead/i;

/** 더술닷컴 주종(탁주(고도)·약주, 청주·증류주·과실주·리큐르/기타주류) → 앱 종류. 모르면 null(넣지 않는다) */
export function categoryOfKind(kind: string, name = "", ingredients = ""): LineupCategory | null {
  const k = (kind || "").trim();
  const text = `${name} ${ingredients}`;
  if (k.startsWith("탁주")) return "탁주";
  if (HONEY.test(name) || /(^|[\s,])(벌꿀|꿀)([\s,(]|$)/.test(ingredients) && !/쌀|누룩/.test(ingredients)) {
    if (k === "과실주" || k.startsWith("리큐르")) return "허니와인";
  }
  if (k.startsWith("약주")) return /청주/.test(name) ? "청주" : "약주";
  if (k === "증류주") return /브랜디|brandy/i.test(text) ? "브랜디" : "증류주";
  if (k === "과실주") return "과실주";
  if (k.startsWith("리큐르")) return "리큐르";
  return null;
}

/* ---------- 4. 맛 프로필 추정 ---------- */

export type ProfileInput = { category: LineupCategory; abv: number | null; name: string; ingredients: string; intro: string };

/** 앱 등록 108종의 종류별 평균(2026-09-13)에서 출발 */
const BASE: Record<LineupCategory, DrinkProfile> = {
  탁주: { sweet: 3, acid: 3, body: 3, fizz: 2, aroma: 3 },
  약주: { sweet: 3, acid: 2, body: 3, fizz: 1, aroma: 4 },
  청주: { sweet: 2, acid: 3, body: 2, fizz: 1, aroma: 3 },
  증류주: { sweet: 2, acid: 1, body: 3, fizz: 1, aroma: 3 },
  과실주: { sweet: 2, acid: 4, body: 3, fizz: 1, aroma: 4 },
  허니와인: { sweet: 4, acid: 2, body: 2, fizz: 1, aroma: 4 },
  리큐르: { sweet: 3, acid: 3, body: 3, fizz: 1, aroma: 4 },
  브랜디: { sweet: 2, acid: 2, body: 4, fizz: 1, aroma: 5 },
};
const clamp = (x: number) => Math.max(1, Math.min(5, Math.round(x)));

/**
 * 공개 제품 정보(이름·원료·소개)에서 맛 프로필 1~5를 추정한다. 사람이 시음해 매긴 값이 아니므로 화면에서는 '맛 분석(추정)'으로만 쓴다.
 * 반환 flavor는 짧은 맛 태그 최대 3개.
 */
export function estimateProfile(p: ProfileInput): { profile: DrinkProfile; flavor: string[] } {
  const b = { ...BASE[p.category] };
  const t = `${p.name} ${p.ingredients} ${p.intro}`;
  const abv = p.abv ?? 0;
  const tags: string[] = [];

  const sparkling = /스파클링|탄산|sparkling|펫낫|샴페인|톡\s?쏘/i.test(t);
  if (sparkling) { b.fizz = 5; tags.push("탄산"); }
  else if (p.category === "탁주" && /생막걸리|생탁|(^|\s)생\s|살아\s?있는|효모가 살아/.test(t)) b.fizz = Math.max(b.fizz, 2);
  if (p.category !== "탁주" && !sparkling) b.fizz = 1;

  const sweetener = /아스파탐|스테비아|수크랄로스|아세설팜|감미료|올리고당|과당|물엿|설탕|꿀/.test(p.ingredients);
  const sweetWord = /달콤|단맛|달달|스위트|sweet/i.test(t);
  const dryWord = /드라이|dry|무감미|감미료\s?(무|없|0)|무첨가|깔끔|담백/i.test(t);
  if (sweetener || sweetWord) b.sweet += 1;
  if (dryWord && !sweetWord) b.sweet -= 1;

  const fruit = /(유자|딸기|복숭아|바나나|사과|포도|머루|복분자|오미자|매실|자두|감귤|레몬|블루베리|오디|석류|키위|참외|수박|샤인머스캣|알밤|고구마)/.exec(t) ?? /(?:^|[^가-힣])(배)(?:$|[^가-힣])/.exec(p.ingredients);
  const tart = /산미|새콤|상큼|시큼|레몬|유자|오미자|복분자|자두|매실|석류|블루베리/.test(t);
  if (tart) b.acid += 1;

  const rich = /걸쭉|진한|진득|묵직|풍부한\s?바디|원주|크리미/.test(t);
  const light = /가벼운|가볍|라이트|산뜻|청량|저도/.test(t);
  if (p.category === "탁주") { if (abv >= 10) b.body += 1; if (abv > 0 && abv <= 6) b.body -= 1; }
  if (p.category === "증류주" || p.category === "리큐르" || p.category === "브랜디") b.body = abv >= 40 ? 4 : abv >= 25 ? 3 : 2;
  if (rich) b.body += 1;
  if (light) b.body -= 1;

  const floral = /꽃|국화|아카시아|진달래|매화|연꽃|장미|허브|솔잎|쑥|생강|계피|인삼|더덕|약초|한약재/.test(t);
  const aged = /오크|숙성|캐스크|배럴|옹기\s?숙성|장기\s?숙성/.test(t);
  if (floral || aged || fruit) b.aroma += 1;
  if (p.category === "증류주" && /깔끔|부드러|순한/.test(t) && !aged) b.aroma -= 1;

  const profile: DrinkProfile = { sweet: clamp(b.sweet), acid: clamp(b.acid), body: clamp(b.body), fizz: clamp(b.fizz), aroma: clamp(b.aroma) };

  if (fruit && tags.length < 3) tags.push(`${fruit[1]}향`);
  if (floral && tags.length < 3) tags.push(/꽃|국화|아카시아|진달래|매화|연꽃|장미/.test(t) ? "꽃향" : "약초향");
  if (aged && tags.length < 3) tags.push("숙성향");
  if (profile.acid >= 4 && tags.length < 3 && !tags.includes("산미")) tags.push("산미");
  if (profile.sweet >= 4 && tags.length < 3) tags.push("달콤");
  else if (profile.sweet <= 1 && tags.length < 3) tags.push("드라이");
  if (profile.body >= 4 && tags.length < 3) tags.push(p.category === "탁주" ? "진한 바디" : "묵직");
  else if (profile.body <= 2 && tags.length < 3) tags.push("가벼움");
  if (abv >= 40 && tags.length < 3) tags.push("높은 도수");
  if (!tags.length) tags.push(p.category === "증류주" ? "깔끔" : p.category === "탁주" ? "곡물향" : "부드러움");
  return { profile, flavor: tags.slice(0, 3) };
}

/* ---------- 5. 설명 문장 ---------- */

const INGREDIENT_WORDS = ["유기농 쌀", "찹쌀", "멥쌀", "쌀", "누룩", "보리", "밀", "옥수수", "고구마", "감자", "조", "수수", "메밀", "벌꿀", "꿀",
  "유자", "딸기", "복숭아", "바나나", "사과", "배", "포도", "머루", "복분자", "오미자", "매실", "자두", "감귤", "블루베리", "오디", "석류", "샤인머스캣", "밤",
  "인삼", "홍삼", "더덕", "생강", "솔잎", "쑥", "국화", "연잎", "진달래", "아카시아", "대추", "구기자", "호박", "흑미", "홍미"];

/** 원료 문자열에서 대표 원료 최대 2개 (물·효모·감미료 등 제외) */
export function mainIngredients(ingredients: string): string[] {
  const s = (ingredients || "").replace(/\(.*?\)/g, " ");
  const hits: { w: string; at: number }[] = [];
  for (const w of INGREDIENT_WORDS) {
    // 한두 글자 원료(쌀·밀·배·조…)는 앞뒤가 한글이 아닐 때만 — "배합"·"제조"에 걸리지 않게
    const m = w.length >= 3 ? { index: s.indexOf(w) } : new RegExp(`(^|[^가-힣])${w}($|[^가-힣])`).exec(s);
    if (!m || m.index < 0) continue;
    const at = w.length >= 3 ? m.index : s.indexOf(w, m.index);
    if (hits.some((h) => h.w.includes(w) && at >= h.at && at < h.at + h.w.length)) continue;   // "유기농 쌀" 속 "쌀"
    hits.push({ w, at });
  }
  return hits.sort((a, b) => a.at - b.at).slice(0, 2).map((h) => h.w);
}

const JONG = (w: string) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
/** '으로/로' — 받침이 없거나 ㄹ받침이면 '로' (쌀로·매실로·누룩으로) */
const EURO = (w: string) => { const c = w.charCodeAt(w.length - 1); const j = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; return j === 0 || j === 8 ? "로" : "으로"; };
/** 설명 문장에서 맛 태그를 명사구로 — "달콤이 특징"처럼 어색해지지 않게 */
const TAG_PHRASE: Record<string, string> = { 달콤: "달콤한 맛", 깔끔: "깔끔한 맛", 가벼움: "가벼운 바디", 부드러움: "부드러운 목넘김", 묵직: "묵직한 바디", 드라이: "드라이한 맛" };

/** 사실만으로 짓는 한두 문장 설명 — 원문 소개글을 옮기지 않는다 */
export function describeDrink(x: { category: LineupCategory; abv: number | null; region: string; brewery: string; ingredients: string; flavor: string[] }): string {
  const ing = mainIngredients(x.ingredients);
  const where = [x.region, x.brewery].filter(Boolean).join(" ");
  const ingText = ing.length === 2 ? `${ing[0]}${JONG(ing[0]) ? "과" : "와"} ${ing[1]}` : ing[0] ?? "";
  const made = ingText ? `${ingText}${EURO(ingText)} 빚은` : "빚은";
  const abv = x.abv != null ? `${Number.isInteger(x.abv) ? x.abv : x.abv.toFixed(1)}도 ` : "";
  const first = `${where ? `${where}에서 ` : ""}${made} ${abv}${x.category}.`.replace(/\s+/g, " ");
  const tags = x.flavor.filter(Boolean).map((t) => TAG_PHRASE[t] ?? t);
  const second = tags.length ? ` ${tags.join("·")}${JONG(tags[tags.length - 1]) ? "이" : "가"} 특징입니다.` : "";
  return first + second;
}

/* ---------- 6. 추천 음식 이름 찾기 ---------- */

export type FoodName = { id: string; name: string; alias?: string[] };
const nz = (s: string) => (s || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

/**
 * 양조장이 등록한 추천 음식 문장에서 카탈로그 음식 찾기 — 긴 이름부터 맞추고, 맞춘 구간은 지워 짧은 이름이 겹쳐 잡히지 않게 한다.
 * 두 글자 이하 별칭(전·굴·배 등)은 다른 단어 속에 흔해서 쓰지 않는다(음식 이름 자체는 허용).
 */
export function matchFoods(text: string, foods: FoodName[]): string[] {
  let s = nz(text);
  if (!s) return [];
  const terms: { id: string; t: string }[] = [];
  for (const f of foods) {
    terms.push({ id: f.id, t: nz(f.name) });
    for (const a of f.alias || []) { const t = nz(a); if (t.length >= 3) terms.push({ id: f.id, t }); }
  }
  terms.sort((a, b) => b.t.length - a.t.length);
  const out: string[] = [];
  for (const { id, t } of terms) {
    if (t.length < 2 || !s.includes(t)) continue;
    s = s.split(t).join("|");
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/* ---------- 7. 맛 궁합(맛 프로필 계산) ---------- */

export type Fit = { s: number; plus: string[]; minus: string[] };

/**
 * 술 프로필 × 음식 프로필 → 궁합 점수(0~100)와 이유. 기존 918개 조합의 이유 문구 16종과 그 조건(데이터에서 역추적)을 그대로 쓴다.
 * 기존 pf.s는 술마다 따로 늘린 값이라 절대값은 다르다 — 새 술의 음식 순위를 정하는 데만 쓴다.
 */
export function profileFit(d: DrinkProfile, abv: number | null, f: FoodProfile): Fit {
  const plus: string[] = [], minus: string[] = [];
  const a = abv ?? 0;
  const dessert = f.spice <= 1 && f.umami <= 1 && f.salt <= 1 && f.sweet >= 4;
  const gap = Math.abs(d.body - f.weight);
  const fmtAbv = Number.isInteger(a) ? String(a) : a.toFixed(1);

  if (gap <= 1) plus.push(`바디 ${d.body}점 ↔ 무게 ${f.weight}점 균형`);
  if (gap >= 3) minus.push(`바디 ${d.body}점과 음식 무게 ${f.weight}점 차이가 큼`);
  if (a >= 25 && d.fizz <= 1 && f.fat >= 3 && f.weight >= 3) plus.push(`도수 ${fmtAbv}%가 진한 기름기·무게를 정리`);
  if (a >= 25 && f.weight <= 2 && f.fat <= 2) minus.push("높은 도수가 가벼운 음식을 압도");
  if (f.umami >= 4 && d.sweet >= 2 && d.sweet <= 4 && d.body >= 3) plus.push("적당한 단맛·바디가 감칠맛을 받쳐줌");
  if (d.aroma <= 3 && f.fat <= 2 && f.spice <= 2 && f.weight <= 2) plus.push("절제된 향이 재료 맛을 살림");
  if (d.aroma >= 5 && d.body >= 3 && f.weight <= 2 && f.fat <= 2) minus.push("강한 향·바디가 섬세한 맛을 가림");
  if (d.acid >= 3 && d.fizz >= 2 && f.fat >= 3 && d.body <= 3) plus.push(`산미 ${d.acid}·탄산 ${d.fizz}점이 기름기 ${f.fat}점을 씻어냄`);
  if (dessert) {
    if (d.sweet >= 3) plus.push(`술 단맛 ${d.sweet}점이 디저트 단맛과 어울림`);
    if (d.sweet <= 2) minus.push("드라이한 술이 디저트 옆에서 시고 쓰게 느껴짐");
  } else if (f.sweet >= 4) {
    if (d.sweet >= 3) plus.push(`술 단맛 ${d.sweet}점이 달콤한 양념과 어울림`);
    if (d.sweet <= 2) minus.push("드라이한 술이 단 양념 옆에서 밋밋해짐");
  }
  if (d.sweet >= 4 && f.spice >= 3) plus.push(`단맛 ${d.sweet}점이 매운맛 ${f.spice}점을 감싸줌`);
  if (d.sweet <= 1 && f.spice >= 4) minus.push("드라이한 술이 매운맛을 더 날카롭게 함");
  if (f.salt >= 4 && f.sweet <= 3 && d.sweet + d.acid >= 5) plus.push("짠맛을 단맛·산미가 중화");
  if (d.sweet >= 4 && f.sweet <= 2 && f.fat <= 2 && f.weight <= 2) minus.push("단 술이 담백한 맛과 겉돎");

  const s = Math.max(0, Math.min(100, 40 + 20 * plus.length - 25 * minus.length - 4 * Math.max(0, gap - 1)));
  return { s, plus, minus };
}

/**
 * 맛 궁합 원점수들을 백분위(0~100)로 — 카탈로그 전체가 한 눈금을 쓰게 한다(2026-09-13). 같은 값은 같은 백분위(중간값).
 * 예) [10, 20, 20, 30] → [13, 50, 50, 88]
 */
export function calibrateFits(raws: number[]): number[] {
  const sorted = [...raws].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return [];
  const lower = new Map<number, number>(), count = new Map<number, number>();
  for (let i = 0; i < n; i++) { const v = sorted[i]; if (!lower.has(v)) lower.set(v, i); count.set(v, (count.get(v) ?? 0) + 1); }
  return raws.map((v) => Math.round(((lower.get(v)! + (count.get(v)! - 1) / 2 + 0.5) / n) * 100));
}

/* ---------- 8. 흔한 이름 걸러내기 ---------- */

/** 여러 양조장이 같은 이름으로 파는 전통 술 종류 이름 — 쇼핑 클릭이 한 제품 몫이 아니다 */
const TYPE_NAMES = ["삼해주", "송절주", "청감주", "이화주", "과하주", "백일주", "소곡주", "두견주", "국화주", "송순주", "오가피주", "인삼주", "홍삼주", "복분자주", "산머루주", "머루주", "오디주", "매실주",
  "허니와인", "벌꿀주", "꿀술", "고량주", "백주", "홍주", "사과와인", "로제와인", "아이스와인", "와인", "감주", "약용주", "송화주", "대잎술", "대나무술", "감자술", "옥수수술"];
const COMMON_WORDS = [...TYPE_NAMES, "프리미엄", "전통", "우리", "명품", "수제", "생", "살균", "막걸리", "탁주", "동동주", "약주", "청주", "법주", "소주", "증류주", "전통주", "와인", "과실주", "리큐르", "술", "주",
  "스파클링", "원주", "유기농", "찹쌀", "쌀", "누룩", "스페셜", "오리지널", "클래식", "에디션", "블랙", "골드", "레드", "화이트", "로제", "드라이", "스위트"];
const PRODUCE = ["유자", "딸기", "복숭아", "바나나", "사과", "배", "포도", "머루", "복분자", "오미자", "매실", "자두", "감귤", "귤", "블루베리", "오디", "석류", "밤", "고구마", "인삼", "홍삼", "더덕", "대추", "꿀", "벌꿀", "옥수수", "보리"];

/**
 * 제품 검색어가 흔한 말뿐인가 — "생막걸리", "사과와인", "포천막걸리"처럼 다른 제품 클릭까지 섞이는 이름.
 * 흔한 말·원료·지명(placeWords: 시군구·시도 이름)을 모두 지웠을 때 두 글자 미만이 남으면 흔한 이름이다.
 * 이런 제품은 양조장 이름을 붙여 검색한다(수요가 부풀지 않게).
 */
export function isGenericKeyword(keyword: string, placeWords: Iterable<string> = []): boolean {
  return keywordCore(keyword, placeWords).length < 2;
}

/** 흔한 말·원료·지명을 지우고 남은 브랜드 부분 — "원소주" → "원", "생막걸리" → "" */
export function keywordCore(keyword: string, placeWords: Iterable<string> = []): string {
  let s = (keyword || "").replace(/[^0-9a-zA-Z가-힣]/g, "");
  const words = [...COMMON_WORDS, ...PRODUCE, ...[...placeWords].filter((w) => w.length >= 2)].sort((a, b) => b.length - a.length);
  for (const w of words) s = s.split(w).join("");
  s = s.replace(/\d+/g, "");
  return s;
}

/* ---------- 9. 이름이 술 이야기로 쓰이는가 ---------- */

/**
 * 블로그 검색 결과 중 이 이름을 **술로** 이야기한 글의 비율 — 쇼핑 클릭이 과일(홍시)·다른 상품(게이샤)·관용구(일엽편주) 몫인지 가려낸다.
 * 이름이 들어간 글만 세고, 이름 자체를 지운 뒤 술 맥락 단어(술·막걸리·양조·안주·시음…)가 남아야 술 이야기로 본다
 * ("대나무술"의 '술'이 스스로 맥락이 되지 않게). 이름이 들어간 글이 없으면 null.
 */
export function drinkContextShare(texts: string[], term: string): { share: number | null; hits: number } {
  const sq = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, "").toLowerCase();
  const k = sq(term);
  if (k.length < 2) return { share: null, hits: 0 };
  let hits = 0, drink = 0;
  for (const raw of texts) {
    const t = sq(raw);
    if (!t.includes(k)) continue;
    hits++;
    if (DRINK_CONTEXT.test(t.split(k).join(" "))) drink++;
  }
  return { share: hits ? Math.round((drink / hits) * 100) / 100 : null, hits };
}

/* ---------- 9-1. 같은 제품의 다른 표기 ---------- */

/** 이름 줄기 — 용량·도수를 떼고 끝의 종류 말(막걸리·주·술…)과 흔한 수식어를 뗀다. "해창 생막걸리" → "해창", "문배술" → "문배" */
export function nameStem(name: string): string {
  let s = shopKeyword(name).toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
  s = s.replace(/\d+(도)?$/, "");
  for (let i = 0; i < 3; i++) s = s.replace(/(프리미엄|스페셜|오리지널|클래식|에디션|생막걸리|막걸리|동동주|탁주|약주|청주|소주|증류주|와인|리큐르|원주|생|술|주)$/, "");
  return s;
}
/** 같은 양조장·같은 종류 안에서 두 이름이 같은 제품인가 — 줄기가 서로 포함(2글자 이상)되거나, 3글자 이상이면서 짧은 줄기의 60% 이상이 겹친다 */
export function isNameVariant(a: string, b: string): boolean {
  const x = nameStem(a), y = nameStem(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) >= 2;
  let best = 0;
  for (let i = 0; i < x.length; i++) for (let j = 0; j < y.length; j++) { let k = 0; while (x[i + k] && x[i + k] === y[j + k]) k++; if (k > best) best = k; }
  return best >= 3 && best >= Math.min(x.length, y.length) * 0.6;
}

/* ---------- 10. 선정 ---------- */

/**
 * 선정 기준 (2026-09-13). total은 기준 키워드(도깨비술) = 100 눈금.
 * minTotal 20 ≈ 현재 라인업 108종 중 하위 40% 수준(현재 라인업 중앙값 53, 하위 25% 4.9) — "지금 라인업에 있어도 이상하지 않은 수요".
 */
export const LINEUP_RULE = { minTotal: 20, minMonths: 6, minHits: 5, minShare: 0.6, minShareDrinkWord: 0.45, perBrewery: 3 };
const NAME_HAS_DRINK_WORD = /막걸리|소주|약주|청주|탁주|증류|리큐르|와인|과실주|브랜디|미드|꿀술|명주|법주|주$|술$/;

export type LineupRow = {
  key: string;
  keyword: string;
  brewery: string;
  category: LineupCategory | null;
  abv: number | null;
  interest: Interest;
  blog?: { hits: number; share: number | null } | null;
  /** 현재 라인업 제품의 다른 표기·용량(같은 양조장·같은 종류·이름 핵심어 겹침) */
  variantOfCatalog?: boolean;
  /** 제품명이 양조장 이름과 같다 — 클릭이 양조장 전체 몫 */
  breweryName?: boolean;
  /** 같은 검색어의 후보가 여러 양조장에 있다 */
  duplicateKeyword?: boolean;
};
export type Judged<T extends LineupRow> = T & { selected: boolean; reason: string };

/** 후보마다 선정 여부와 이유 — 수요 큰 순서로 돌려준다 */
export function judgeLineup<T extends LineupRow>(rows: T[], rule = LINEUP_RULE): Judged<T>[] {
  const sorted = [...rows].sort((a, b) => b.interest.total - a.interest.total || b.interest.recent - a.interest.recent);
  const perBrewery = new Map<string, number>();
  const picked: T[] = [];
  return sorted.map((r) => {
    const no = (reason: string) => ({ ...r, selected: false, reason });
    if (!r.category || r.abv == null) return no("종류·도수 정보 없음");
    if (r.variantOfCatalog) return no("현재 라인업 제품의 다른 표기");
    if (r.duplicateKeyword) return no("같은 이름을 여러 양조장이 씀");
    if (r.breweryName) return no("제품명이 양조장 이름과 같음");
    if (r.interest.total <= 0) return no("네이버 쇼핑 클릭 없음");
    if (r.interest.total < rule.minTotal) return no(`쇼핑 수요 낮음(${r.interest.total} < ${rule.minTotal})`);
    if (r.interest.months < rule.minMonths) return no(`12개월 중 ${r.interest.months}개월만 클릭`);
    const b = r.blog;
    const need = NAME_HAS_DRINK_WORD.test(r.keyword) ? rule.minShareDrinkWord : rule.minShare;
    if (!b || b.hits < rule.minHits || b.share == null || b.share < need) return no(`블로그에서 술 이야기로 확인 안 됨(${b?.share ?? "-"}, ${b?.hits ?? 0}건)`);
    const twin = picked.find((p) => p.brewery === r.brewery && p.category === r.category && isNameVariant(p.keyword, r.keyword));
    if (twin) return no(`선정된 '${twin.keyword}'의 다른 표기`);
    const n = perBrewery.get(r.brewery) ?? 0;
    if (n >= rule.perBrewery) return no(`양조장당 ${rule.perBrewery}종 초과`);
    perBrewery.set(r.brewery, n + 1);
    picked.push(r);
    return { ...r, selected: true, reason: "선정" };
  });
}

/* ---------- 11. 새 술의 페어링 ---------- */

/** 같은 종류 술의 전문가 조합 빈도 — 근거가 있는 조합(official·sommelier·media·blog)만 센다 */
export type Affinity = { counts: Map<string, number>; max: number; label: string };

/**
 * 종류별 음식 친화도. 같은 종류에 근거 있는 술이 minDrinks 미만이면(브랜디·청주처럼 적은 종류) 전체 술 기준으로 대신한다.
 * 실측(2026-09-13, 기존 81종을 하나씩 빼고 맞히기): 맛 프로필 궁합만으로 고른 음식 8개가 실제 근거 조합과 겹친 비율 8.5%(무작위 7.3%),
 * 같은 종류 친화도로 고르면 22.3% — 그래서 친화도를 먼저, 맛 궁합은 감점 조합을 빼는 데 쓴다.
 */
export function categoryAffinity(pairings: { d: string; f: string; src?: string | null }[], drinks: { id: string; category: string }[], category: string, minDrinks = 3): Affinity {
  const backed = pairings.filter((p) => p.src && p.src !== "profile" && p.src !== "ai");
  const catOf = new Map(drinks.map((d) => [d.id, d.category]));
  const inCat = backed.filter((p) => catOf.get(p.d) === category);
  const use = new Set(inCat.map((p) => p.d)).size >= minDrinks ? inCat : backed;
  const counts = new Map<string, number>();
  for (const p of use) counts.set(p.f, (counts.get(p.f) ?? 0) + 1);
  return { counts, max: Math.max(1, ...counts.values()), label: use === inCat ? category : "전통주" };
}

export type PlanFood = { id: string; name: string; category: string; profile?: FoodProfile; trend?: { score?: number | null } | null };
export type PlannedPairing = { f: string; es: number; src: "official" | "profile"; reason: string; pf: Fit };

/**
 * 새 술의 페어링 목록 — 양조장이 공개 제품 정보에 적은 추천 음식(official, 최대 4) + 맛 분석(profile)으로 총 `total`개.
 * 맛 분석 순서: ① 같은 종류 전통주의 전문가 조합 친화도(affinity) ② 맛 프로필 궁합 점수 ③ 이번 확장에서 덜 쓴 음식(usage) ④ 인기 음식.
 * 맛 프로필 감점 이유가 있는 음식은 뺀다. 같은 음식 분류는 `perCategory`개까지(디저트만 8개 같은 쏠림 방지).
 * es: 양조장 추천 90(검수된 공식 인용 91~97보다 한 단계 아래), 맛 분석 84~87(기존 맛 프로필 조합과 같은 범위).
 */
export function planPairings(drink: { profile: DrinkProfile; abv: number | null }, foods: PlanFood[], officialIds: string[], opts = { total: 8, perCategory: 2, maxOfficial: 4 }, usage?: Map<string, number>, affinity?: Affinity): PlannedPairing[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const out: PlannedPairing[] = [];
  const perCat = new Map<string, number>();
  for (const id of officialIds.slice(0, opts.maxOfficial)) {
    const f = byId.get(id);
    if (!f?.profile) continue;
    const pf = profileFit(drink.profile, drink.abv, f.profile);
    out.push({ f: id, es: 90, src: "official", reason: `양조장이 공개 제품 정보에서 추천한 음식입니다.${pf.plus[0] ? ` 맛 프로필로 봐도 ${pf.plus[0]}.` : ""}`, pf });
    perCat.set(f.category, (perCat.get(f.category) ?? 0) + 1);
  }
  const aff = (id: string) => (affinity ? (affinity.counts.get(id) ?? 0) / affinity.max : 0);
  const ranked = foods
    .filter((f) => f.profile && !out.some((o) => o.f === f.id))
    .map((f) => ({ f, pf: profileFit(drink.profile, drink.abv, f.profile!), a: aff(f.id) }))
    .filter((x) => x.pf.minus.length === 0 && (x.a > 0 || x.pf.plus.length > 0))
    .sort((x, y) => (y.a * 100 + y.pf.s / 10) - (x.a * 100 + x.pf.s / 10) || (usage?.get(x.f.id) ?? 0) - (usage?.get(y.f.id) ?? 0) || (y.f.trend?.score ?? 0) - (x.f.trend?.score ?? 0));
  // 앞 3개는 점수 순서 그대로, 나머지는 상위 20개 후보 안에서 이번 확장에 덜 쓴 음식부터 — 같은 종류 술이 모두 같은 8개가 되지 않게
  const KEEP = 3, POOL = 20;
  const order: typeof ranked = [];
  const tryAdd = (x: (typeof ranked)[number]) => { const n = perCat.get(x.f.category) ?? 0; if (n >= opts.perCategory || order.includes(x)) return; perCat.set(x.f.category, n + 1); order.push(x); };
  for (const x of ranked) { if (order.length >= KEEP || out.length + order.length >= opts.total) break; tryAdd(x); }
  const pool = ranked.filter((x) => !order.includes(x)).slice(0, POOL).sort((x, y) => (usage?.get(x.f.id) ?? 0) - (usage?.get(y.f.id) ?? 0) || ranked.indexOf(x) - ranked.indexOf(y));
  for (const x of [...pool, ...ranked]) { if (out.length + order.length >= opts.total) break; tryAdd(x); }
  for (const { f, pf, a } of order) {
    const es = 84 + (a >= 0.5 ? 2 : a > 0 ? 1 : 0) + (pf.s >= 60 ? 1 : 0);
    const times = affinity?.counts.get(f.id) ?? 0;
    const why = [
      times ? `다른 ${affinity!.label}에서 양조장·전문가·후기가 ${times}번 짝지은 음식` : "",
      pf.plus.length ? `맛 프로필로는 ${pf.plus.slice(0, 2).join(", ")}` : "",
    ].filter(Boolean).join(". ");
    out.push({ f: f.id, es, src: "profile", reason: `${why}. (맛 분석 — 이 술로 직접 확인된 조합은 아닙니다)`, pf });
  }
  if (usage) for (const o of out) usage.set(o.f, (usage.get(o.f) ?? 0) + 1);
  return out;
}
