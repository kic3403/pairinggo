/**
 * 상황 검색 — 규칙 기반 자연어 파서.
 *   "매운 안주에 어울리는 술"     → 대상 술, 음식 조건 spice≥3 → 조건에 맞는 음식들의 페어링을 모아 술 순위
 *   "도수 낮은 달달한 막걸리"      → 대상 술, 술 조건 abv≤8·sweet≥4·탁주
 *   "복순도가에 어울리는 안주"      → 대상 음식, 특정 술의 페어링
 *   "선물용 증류주"              → 대상 술, 증류주 + 선물 가중(수상·도수)
 * 해석되지 않으면 null → 일반 검색 폴백. 부분 해석 시 해석된 조건만 쓴다. (나머지 상황은 Phase 9 AI)
 */
import { byDrink, byFood, D, DATA, F, tscore } from "../data";
import type { Drink, DrinkProfile, Food, FoodProfile, Pairing } from "../types";
import { REGIONS } from "../regions";
import { DRINK_DOCS, FOOD_DOCS } from "./docs";
import { findCategory, normalize } from "./normalize";

export type Target = "drink" | "food";
type Cmp = { key: string; op: ">=" | "<="; v: number; label: string };

export type Intent = {
  target: Target;
  /** 술 쪽 조건 (대상이 술이면 필터, 음식이 대상이면 '주어'의 조건) */
  drink: { profile: Cmp[]; abv?: Cmp; category?: string; region?: string; award?: boolean; ids: string[] };
  /** 음식 쪽 조건 */
  food: { profile: Cmp[]; category?: string; ids: string[] };
  gift: boolean;
  /** 해석 결과 문구 (칩) */
  explain: string[];
  /** 파서가 소비하고 남은 검색어 (일반 매칭에 넘길 수 있음) */
  residual: string;
};

/* ---------- 사전 ---------- */
type Rule = { re: RegExp; side: "drink" | "food" | "any"; cmp: Omit<Cmp, "label">; label: string };
const TASTE: Rule[] = [
  { re: /매운|매콤|얼큰|칼칼/, side: "food", cmp: { key: "spice", op: ">=", v: 3 }, label: "매운 음식" },
  { re: /기름진|느끼|기름기/, side: "food", cmp: { key: "fat", op: ">=", v: 4 }, label: "기름진 음식" },
  { re: /담백/, side: "food", cmp: { key: "fat", op: "<=", v: 2 }, label: "담백한 음식" },
  { re: /감칠|짭짤|짠\s|짠맛/, side: "food", cmp: { key: "umami", op: ">=", v: 4 }, label: "감칠맛 있는 음식" },
  { re: /달달|달콤|단맛|단\s|달아|스위트/, side: "any", cmp: { key: "sweet", op: ">=", v: 4 }, label: "단맛" },
  { re: /드라이|안\s?단|달지\s?않|씁쓸|쌉쌀|덜\s?단/, side: "drink", cmp: { key: "sweet", op: "<=", v: 2 }, label: "드라이" },
  { re: /상큼|새콤|산미|시큼|산뜻/, side: "drink", cmp: { key: "acid", op: ">=", v: 4 }, label: "산미" },
  { re: /탄산|톡\s?쏘|스파클링|청량/, side: "drink", cmp: { key: "fizz", op: ">=", v: 4 }, label: "탄산" },
  { re: /진한|묵직|풀바디|무거운/, side: "drink", cmp: { key: "body", op: ">=", v: 4 }, label: "묵직한 바디" },
  { re: /가벼운|가볍|라이트|부담\s?없/, side: "drink", cmp: { key: "body", op: "<=", v: 2 }, label: "가벼운 바디" },
  { re: /향긋|향\s?좋|아로마|향이\s?진/, side: "drink", cmp: { key: "aroma", op: ">=", v: 4 }, label: "향이 좋은" },
];
const FOOD_CATEGORY_WORDS: [RegExp, string][] = [
  [/회|사시미/, "회"], [/구이|고기|바베큐|바비큐/, "구이"], [/\b전\b|전류|부침개|파전/, "전"], [/해산물|해물|조개|새우|생선/, "해산물"],
  [/치킨|닭/, "치킨"], [/분식|떡볶이/, "분식"], [/디저트|케이크|초콜릿|과자|달다구리/, "디저트"], [/양식|파스타|피자|스테이크/, "양식"],
  [/중식|중국|짜장|짬뽕|마라/, "중식"], [/일식|스시|라멘/, "일식"], [/튀김/, "튀김"], [/면|국수|라면/, "면"], [/마른안주|육포|견과/, "마른안주"],
];
const DRINK_WORD = /(전통주|우리술|막걸리|탁주|약주|청주|증류주|소주|과실주|와인|리큐르|브랜디|허니와인|술|한잔|한\s?병)/;
const FOOD_WORD = /(안주|음식|요리|먹을|먹지|메뉴|반찬)/;
const CONNECTOR = /(에|랑|이랑|와|과|하고|에는|에게|엔)\s*(어울리|맞는|좋은|잘\s?맞|찰떡|궁합|곁들|같이|함께|페어링)/;

/* ---------- 지역 토큰 (데이터 region 첫 두 토큰 + 관심지역 라벨) ---------- */
const REGION_TOKENS: string[] = (() => {
  const s = new Set<string>();
  for (const r of REGIONS) if (r.id !== "all") r.label.split("/").forEach((l) => { const t = l.trim(); if (t.length >= 2 && t !== "전체") s.add(t); });
  for (const d of DATA.drinks) (d.region || "").split(" ").slice(0, 2).forEach((t) => { if (t.length >= 2) s.add(t); });
  return [...s].sort((a, b) => b.length - a.length);
})();

/* ---------- 이름 추출: 검색어 안의 술/음식 이름 (긴 것 우선, 겹치지 않게) ---------- */
function extractNames(norm: string): { drinks: string[]; foods: string[]; consumed: string } {
  let rest = norm;
  const drinks: string[] = []; const foods: string[] = [];
  const cands = [
    ...DRINK_DOCS.flatMap((d) => [{ t: "drink" as const, id: d.id, n: d.norm }, ...d.aliases.map((a) => ({ t: "drink" as const, id: d.id, n: a.norm }))]),
    ...FOOD_DOCS.flatMap((f) => [{ t: "food" as const, id: f.id, n: f.norm }, ...f.aliases.map((a) => ({ t: "food" as const, id: f.id, n: a.norm }))]),
  ].filter((c) => c.n.length >= 2).sort((a, b) => b.n.length - a.n.length);
  for (const c of cands) {
    if (rest.includes(c.n)) {
      (c.t === "drink" ? drinks : foods).push(c.id);
      rest = rest.replace(c.n, "|");
    }
  }
  return { drinks: [...new Set(drinks)], foods: [...new Set(foods)], consumed: rest };
}

/* ---------- 파서 ---------- */
export function parseIntent(q: string): Intent | null {
  const raw = q.trim();
  if (!raw) return null;
  const norm = normalize(raw);
  const explain: string[] = [];
  const intent: Intent = { target: "drink", drink: { profile: [], ids: [] }, food: { profile: [], ids: [] }, gift: false, explain, residual: "" };
  let recognized = 0;

  // 1) 연결어로 주어/대상 분리
  const m = raw.match(CONNECTOR);
  const left = m ? raw.slice(0, m.index!) : "";
  const right = m ? raw.slice(m.index! + m[0].length) : raw;
  const hasConnector = !!m;

  // 2) 대상 판별
  const rightDrink = DRINK_WORD.test(right), rightFood = FOOD_WORD.test(right);
  const leftDrink = DRINK_WORD.test(left), leftFood = FOOD_WORD.test(left);
  const names = extractNames(norm);
  if (hasConnector) {
    if (rightDrink && !rightFood) intent.target = "drink";
    else if (rightFood && !rightDrink) intent.target = "food";
    else if (names.foods.length && !names.drinks.length) intent.target = "drink";
    else if (names.drinks.length && !names.foods.length) intent.target = "food";
    else if (leftFood) intent.target = "drink";
    else if (leftDrink) intent.target = "food";
    else intent.target = "drink";
    recognized++;
  } else {
    if (rightFood && !rightDrink) intent.target = "food";
    else if (rightDrink) intent.target = "drink";
    else if (names.foods.length && !names.drinks.length && /추천|어울|뭐/.test(raw)) intent.target = "drink";
    else intent.target = "drink";
  }
  const subjectSide: Target = intent.target === "drink" ? "food" : "drink";

  // 3) 이름 조건 (주어 쪽) — "복순도가에 어울리는 안주", "삼겹살에 어울리는 술", "삼겹살 술 추천"
  if (names.drinks.length && intent.target === "food") { intent.drink.ids = names.drinks; explain.push(...names.drinks.map((id) => D[id].name)); recognized++; }
  if (names.foods.length && intent.target === "drink") { intent.food.ids = names.foods; explain.push(...names.foods.map((id) => F[id].name)); recognized++; }
  // 이름만 있고 아무 상황 단서가 없으면 일반 검색이 낫다
  if ((names.drinks.length || names.foods.length) && !hasConnector && !/추천|어울|뭐|찾/.test(raw)) return null;

  // 4) 맛 조건: 연결어가 있으면 왼쪽은 주어 쪽, 오른쪽은 대상 쪽. 없으면 대상 쪽
  const applyTaste = (text: string, side: Target) => {
    for (const r of TASTE) {
      if (!r.re.test(text)) continue;
      const s = r.side === "any" ? side : r.side;
      if (s === "food" && side !== "food" && r.side !== "any") { if (side === "drink" && intent.target === "drink" && !hasConnector) { intent.food.profile.push({ ...r.cmp, label: r.label }); explain.push(r.label); recognized++; } continue; }
      if (s === "drink" && side !== "drink" && r.side !== "any") continue;
      const list = s === "drink" ? intent.drink.profile : intent.food.profile;
      if (!list.some((c) => c.key === r.cmp.key)) { list.push({ ...r.cmp, label: r.label }); explain.push(r.label); recognized++; }
    }
  };
  if (hasConnector) { applyTaste(left, subjectSide); applyTaste(right, intent.target); }
  else applyTaste(raw, intent.target);

  // 5) 도수
  const abvLow = /도수\s*(낮|약|안\s?높)|저도수|순한/.test(raw);
  const abvHigh = /도수\s*(높|센|쎈|독)|고도수|독한|센\s?술|쎈\s?술/.test(raw);
  const abvNum = raw.match(/(\d{1,2})\s*(도|%)\s*(이하|미만|아래|밑|이상|넘|초과|위)/);
  if (abvNum) { const v = parseInt(abvNum[1]); const le = /이하|미만|아래|밑/.test(abvNum[3]); intent.drink.abv = { key: "abv", op: le ? "<=" : ">=", v, label: `도수 ${v}% ${le ? "이하" : "이상"}` }; explain.push(intent.drink.abv.label); recognized++; }
  else if (abvLow) { intent.drink.abv = { key: "abv", op: "<=", v: 8, label: "도수 8% 이하" }; explain.push("도수 낮은"); recognized++; }
  else if (abvHigh) { intent.drink.abv = { key: "abv", op: ">=", v: 25, label: "도수 25% 이상" }; explain.push("도수 높은"); recognized++; }

  // 6) 술 종류 · 음식 분류 · 지역 · 수상 · 선물
  const cat = findCategory(norm.replace(/술$/, ""));
  if (cat && !(cat.word === "술")) { intent.drink.category = cat.category; explain.push(cat.category); recognized++; }
  if (intent.target === "food" || hasConnector) {
    const side = hasConnector ? left : raw;
    for (const [re, c] of FOOD_CATEGORY_WORDS) { if (re.test(side) && !names.foods.length) { intent.food.category = c; explain.push(`${c} 종류`); recognized++; break; } }
  } else if (intent.target === "drink" && !hasConnector) {
    // "회에 좋은 술" 처럼 연결어가 없어도 음식 분류 단어가 있으면 주어로 본다 (예: "회 술 추천")
    for (const [re, c] of FOOD_CATEGORY_WORDS) { if (re.test(raw) && !names.foods.length && FOOD_WORD.test(raw) === false && c !== "면") { intent.food.category = c; explain.push(`${c} 종류`); recognized++; break; } }
  }
  for (const t of REGION_TOKENS) { if (norm.includes(normalize(t)) && !names.drinks.some((id) => normalize(D[id].name).includes(normalize(t)))) { intent.drink.region = t; explain.push(`${t} 술`); recognized++; break; } }
  if (/대통령상|수상작|수상|품평회|금상|대상/.test(raw)) { intent.drink.award = true; explain.push("수상작"); recognized++; }
  if (/선물|기념|명절|추석|설날|답례/.test(raw)) { intent.gift = true; explain.push("선물용"); recognized++; }

  if (!recognized) return null;
  intent.residual = names.consumed.replace(/\|/g, " ").trim();
  return intent;
}

/* ---------- 실행 ---------- */
export type IntentDrinkRow = { drink: Drink; score: number; count: number; via: Pairing | null; reasons: string[] };
export type IntentFoodRow = { food: Food; score: number; count: number; via: Pairing | null; reasons: string[] };
export type IntentResult = { intent: Intent; drinks: IntentDrinkRow[]; foods: IntentFoodRow[]; matchedSubjects: number };

const cmpOk = (v: number | null | undefined, c: Cmp) => v != null && (c.op === ">=" ? v >= c.v : v <= c.v);
const drinkOk = (d: Drink, it: Intent) => {
  const p = d.profile as DrinkProfile | undefined;
  if (it.drink.profile.length && (!p || !it.drink.profile.every((c) => cmpOk(p[c.key as keyof DrinkProfile], c)))) return false;
  if (it.drink.abv && !cmpOk(d.abv, it.drink.abv)) return false;
  if (it.drink.category && d.category !== it.drink.category) return false;
  if (it.drink.region && !(d.region || "").includes(it.drink.region)) return false;
  if (it.drink.award && !(d.awards || []).length) return false;
  return true;
};
const foodOk = (f: Food, it: Intent) => {
  const p = f.profile as FoodProfile | undefined;
  if (it.food.profile.length && (!p || !it.food.profile.every((c) => cmpOk(p[c.key as keyof FoodProfile], c)))) return false;
  if (it.food.category && f.category !== it.food.category) return false;
  return true;
};
/** 선물용: 수상작을 최우선(+100, 트렌드 점수 0~100을 넘도록)으로 앞세우고, 병 선물에 어울리는 종류·도수를 가산 */
const giftBoost = (d: Drink) => ((d.awards || []).length ? 100 : 0) + (["증류주", "과실주", "브랜디", "허니와인"].includes(d.category) ? 6 : 0) + ((d.abv ?? 0) >= 13 ? 3 : 0);

export function runIntent(it: Intent, limit = 10): IntentResult {
  const out: IntentResult = { intent: it, drinks: [], foods: [], matchedSubjects: 0 };
  if (it.target === "drink") {
    // 주어(음식) 집합
    const subjects: Food[] = it.food.ids.length ? it.food.ids.map((id) => F[id])
      : (it.food.profile.length || it.food.category) ? DATA.foods.filter((f) => foodOk(f, it)) : [];
    out.matchedSubjects = subjects.length;
    if (subjects.length) {
      const agg = new Map<string, { sum: number; count: number; best: Pairing }>();
      for (const f of subjects) for (const p of byFood[f.id] || []) {
        const a = agg.get(p.d) || { sum: 0, count: 0, best: p };
        a.sum += p.es; a.count++; if (p.es > a.best.es) a.best = p; agg.set(p.d, a);
      }
      out.drinks = [...agg.entries()].map(([id, a]) => {
        const d = D[id];
        const score = a.sum / a.count + Math.min(a.count, 5) * 1.5 + (it.gift ? giftBoost(d) : 0);
        return { drink: d, score, count: a.count, via: a.best, reasons: [a.best.reason] };
      }).filter((r) => drinkOk(r.drink, it)).sort((a, b) => b.score - a.score || tscore(b.drink) - tscore(a.drink)).slice(0, limit);
    } else {
      out.drinks = DATA.drinks.filter((d) => drinkOk(d, it)).map((d) => ({
        drink: d, score: tscore(d) + (d.awards?.length ? 10 : 0) + (it.gift ? giftBoost(d) : 0), count: 0, via: null, reasons: [d.desc],
      })).sort((a, b) => b.score - a.score).slice(0, limit);
    }
  } else {
    const subjects: Drink[] = it.drink.ids.length ? it.drink.ids.map((id) => D[id])
      : (it.drink.profile.length || it.drink.abv || it.drink.category || it.drink.region || it.drink.award) ? DATA.drinks.filter((d) => drinkOk(d, it)) : [];
    out.matchedSubjects = subjects.length;
    if (subjects.length) {
      const agg = new Map<string, { sum: number; count: number; best: Pairing }>();
      for (const d of subjects) for (const p of byDrink[d.id] || []) {
        const a = agg.get(p.f) || { sum: 0, count: 0, best: p };
        a.sum += p.es; a.count++; if (p.es > a.best.es) a.best = p; agg.set(p.f, a);
      }
      out.foods = [...agg.entries()].map(([id, a]) => ({ food: F[id], score: a.sum / a.count + Math.min(a.count, 5) * 1.5, count: a.count, via: a.best, reasons: [a.best.reason] }))
        .filter((r) => foodOk(r.food, it)).sort((a, b) => b.score - a.score || tscore(b.food) - tscore(a.food)).slice(0, limit);
    } else {
      out.foods = DATA.foods.filter((f) => foodOk(f, it)).map((f) => ({ food: f, score: tscore(f), count: 0, via: null, reasons: [f.tags.join(" · ")] }))
        .sort((a, b) => b.score - a.score).slice(0, limit);
    }
  }
  return out;
}

/** 한 번에: 파싱 + 실행. 해석 불가면 null */
export function intentSearch(q: string, limit = 10): IntentResult | null {
  const it = parseIntent(q);
  return it ? runIntent(it, limit) : null;
}
