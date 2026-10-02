/**
 * 상황 추천 — 사는 곳의 날씨·계절에 맞는 조합(2026-10-02 사용자 요청, docs/29).
 * 근거 점수·등급과 섞지 않는다: 카드 순위는 그대로 두고 **따로 둔 칸**("오늘 같은 날엔")에만 쓴다.
 * 규칙은 docs/28 실측(네이버 데이터랩 3년 + 기상청 서울 2년 대조)이 뒷받침하는 것만:
 *   비·눈      → 전 1.7배 · 막걸리 1.2배(같은 달 안 비교 20달 중 19~20달 일관)
 *   5℃ 미만    → 전통소주 1.4배 · 와인 1.7배 · 약주 1.6배 · 국물 1.4배, "따뜻한 술" 9.5배
 *   25℃ 이상   → 냉면·물회 3.8배, 막걸리는 가장 낮음(과실주·시원한 술)
 *   5~15℃(가을) → 약주·청주 134 · 전통소주 110 · 구이 119(10월 지수)
 *   15~25℃(봄)  → 막걸리 5월 114가 1년 중 최고
 * 날씨를 모르면(지역 없음·조회 실패) 계절만으로 판정한다 — 그래서 칸이 비지 않는다.
 * 날씨 받기는 packages/server/weather.ts(기상청 초단기실황), 화면은 web `WeatherPick`. 여기는 판정·문구·고르기만.
 */
import type { Dataset, Drink, Food, Pairing } from "./types";
import { kindOf } from "./catalog/kinds";
import { confidenceOf, type Confidence } from "./pairing/confidence";
import { pairingScore } from "./pairing/score";
import { SEASON_FOODS, seasonOf, type Season } from "./pairing/today";
import { SIDO_OPTIONS } from "./profile";
import { RBY } from "./regions";

/* ---------- 시·도 ---------- */

/** 회원 프로필의 시·도(긴 이름) → 짧은 이름(카탈로그 region·기상청 격자 키). 광주는 전남에 묶는다(2026-07 통합) */
export const SIDO_SHORT: Record<(typeof SIDO_OPTIONS)[number], string> = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
  경기도: "경기", 강원특별자치도: "강원", 충청북도: "충북", 충청남도: "충남", 전북특별자치도: "전북", 전남광주통합특별시: "전남", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
};
/** 기상청 초단기실황 격자(nx, ny) — 시·도 대표 지점(도청 소재지 또는 중심 도시). 지역이 넓은 도는 한 점으로 대표한다 */
export const WEATHER_GRID: Record<string, { nx: number; ny: number; at: string }> = {
  서울: { nx: 60, ny: 127, at: "서울" }, 부산: { nx: 98, ny: 76, at: "부산" }, 대구: { nx: 89, ny: 90, at: "대구" }, 인천: { nx: 55, ny: 124, at: "인천" },
  대전: { nx: 67, ny: 100, at: "대전" }, 울산: { nx: 102, ny: 84, at: "울산" }, 세종: { nx: 66, ny: 103, at: "세종" }, 경기: { nx: 60, ny: 121, at: "수원" },
  강원: { nx: 73, ny: 134, at: "춘천" }, 충북: { nx: 69, ny: 107, at: "청주" }, 충남: { nx: 55, ny: 106, at: "홍성" }, 전북: { nx: 63, ny: 89, at: "전주" },
  전남: { nx: 58, ny: 74, at: "광주" }, 경북: { nx: 91, ny: 106, at: "안동" }, 경남: { nx: 90, ny: 77, at: "창원" }, 제주: { nx: 52, ny: 38, at: "제주" },
};
export const SIDO_SHORTS = Object.keys(WEATHER_GRID);

/** 긴 이름·짧은 이름 어느 쪽이 와도 짧은 이름으로. 모르는 값은 null */
export function sidoShort(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (s in WEATHER_GRID) return s;
  return (SIDO_SHORT as Record<string, string>)[s] ?? null;
}
/** 관심 지역(regions.ts id) → 짧은 시·도. 전국·모르는 id는 null, 묶음 지역(충남/충북·전남/전북)은 앞쪽 */
export function sidoOfRegion(id: string | null | undefined): string | null {
  if (!id || id === "all") return null;
  const r = RBY[id];
  if (!r) return null;
  if (id === "cap") return "서울";
  return sidoShort(r.pre[0]?.split(" ")[0] ?? null);
}

/* ---------- 판정 ---------- */

export type Band = "cold" | "cool" | "warm" | "hot";
export type Precip = "none" | "rain" | "snow";
export type RuleKey = "rain" | "snow" | Band;
/** 지금 날씨(기상청 초단기실황 한 줄) — temp는 기온(℃), pty는 강수형태 코드 */
export type WeatherNow = { sido: string; temp: number | null; pty: number; rn1?: number | null; at: string };

/** 강수형태 코드(기상청 PTY) → 비·눈. 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 5 빗방울 · 6 빗방울눈날림 · 7 눈날림 */
export function precipOf(pty: number | null | undefined): Precip {
  if (pty === 3 || pty === 7) return "snow";
  if (pty === 1 || pty === 2 || pty === 5 || pty === 6) return "rain";
  return "none";
}
/** 기온 → 구간. 모르면 계절로(겨울 추움·가을 선선·봄 따뜻·여름 더움) */
export function bandOf(temp: number | null | undefined, season: Season): Band {
  if (typeof temp === "number" && Number.isFinite(temp)) return temp < 5 ? "cold" : temp < 15 ? "cool" : temp < 25 ? "warm" : "hot";
  return season === "winter" ? "cold" : season === "autumn" ? "cool" : season === "spring" ? "warm" : "hot";
}

export type Situation = {
  key: RuleKey; season: Season; band: Band; precip: Precip;
  temp: number | null; sido: string | null;
  /** 날씨로 판정했는지(false면 계절만) */
  fromWeather: boolean;
  icon: string; headline: string; why: string;
  /** 추천 칸 제목 — "오늘 같은 날엔" */
  title: string;
};

const WHY: Record<RuleKey, string> = {
  rain: "비 오는 날엔 전 검색이 1.7배, 막걸리가 1.2배 늘어요 — 네이버 검색과 기상청 2년치를 맞춰 봤어요.",
  snow: "눈 오는 날엔 전과 따끈한 술이 당기죠. 5℃ 아래로 내려가면 증류주·약주 검색이 1.5배 늘어요.",
  cold: "5℃ 아래로 내려가면 전통소주·와인·약주 검색이 1.4~1.7배, 국물 요리도 1.4배 늘어요.",
  cool: "선선해지면 약주·청주 검색이 평소보다 30% 넘게 늘고 구이도 많이 찾아요.",
  warm: "15~25℃ 봄·가을 날씨엔 막걸리를 가장 많이 찾아요(5월이 1년 중 최고) — 전·나물과 함께 가볍게.",
  hot: "25℃를 넘으면 냉면·물회 검색이 3.8배 늘고 시원한 술을 찾아요. 막걸리는 이때 가장 적어요.",
};
const ICON: Record<RuleKey, string> = { rain: "☔", snow: "❄️", cold: "🧣", cool: "🍂", warm: "🌿", hot: "🧊" };

/** 지금 상황 — date는 한국 날짜(YYYY-MM-DD), weather가 없으면 계절만으로 */
export function situationOf(date: string, weather?: WeatherNow | null, sido?: string | null): Situation {
  const season = seasonOf(date);
  const w = weather && typeof weather.temp === "number" ? weather : null;
  const temp = w ? Math.round(w.temp! * 10) / 10 : null;
  const precip = precipOf(weather?.pty);
  const band = bandOf(temp, season);
  const key: RuleKey = precip === "none" ? band : precip;
  const where = sido ?? weather?.sido ?? null;
  const fromWeather = !!weather;
  const t = temp === null ? "" : `${Math.round(temp)}℃`;
  const pre = fromWeather && where ? `${where} ${t}`.trim() + " · " : "";
  const headline =
    key === "rain" ? `${pre}비 오는 날엔 막걸리에 전` :
    key === "snow" ? `${pre}눈 오는 날엔 전에 따끈한 술` :
    key === "cold" ? `${pre}추운 날엔 도수 있는 술 한 잔` :
    key === "cool" ? `${pre}선선한 날엔 약주·청주 한 잔` :
    key === "warm" ? `${pre}봄·가을 날씨엔 막걸리 한 사발` :
    `${pre}더운 날엔 시원하게`;
  return { key, season, band, precip, temp, sido: where, fromWeather, icon: ICON[key], headline, why: WHY[key], title: "오늘 같은 날엔" };
}

/* ---------- 술·음식 맞춤 ---------- */

const SOUP = /탕|전골|찌개|국밥|나베|샤브/;
const STRONG = new Set(["증류주", "브랜디"]);
const YAKJU = new Set(["약주", "청주"]);
const inSeason = (s: Season, f: Pick<Food, "name">) => SEASON_FOODS[s].includes(f.name);

/**
 * 상황마다 도수가 비슷한 술 묶음(0부터) — 추천은 묶음을 돌아가며 골고루 낸다(2026-10-02 사용자 요청: 막걸리만이 아니라 막걸리·약주·와인처럼).
 * 0번 묶음이 실측 근거가 가장 센 것(비 = 탁주, 추움 = 25도↑ 증류주, 선선 = 약주·청주, 봄·가을 = 탁주, 더움 = 저도수 탁주). 묶음이 없으면 상황에 맞지 않는 술.
 */
export function drinkGroup(key: RuleKey, d: Pick<Drink, "category" | "abv" | "kind">): number | null {
  const k = kindOf(d), c = d.category, abv = d.abv ?? 0, trad = k === "trad";
  const lightFruit = (trad && c === "과실주" && abv <= 14) || k === "wine";   // 가벼운 과실주·와인
  switch (key) {
    case "rain": return trad && c === "탁주" ? 0 : trad && YAKJU.has(c) ? 1 : lightFruit ? 2 : null;
    case "snow":
    case "cold": return trad && (abv >= 25 || STRONG.has(c)) ? 0 : trad && YAKJU.has(c) ? 1 : k === "wine" || (trad && c === "과실주" && abv >= 14) ? 2 : k === "whisky" || k === "sake" ? 3 : null;
    case "cool": return trad && YAKJU.has(c) ? 0 : trad && abv >= 12 && abv <= 25 && c !== "탁주" ? 1 : k === "wine" || k === "sake" ? 2 : null;
    case "warm": return trad && c === "탁주" ? 0 : trad && YAKJU.has(c) && abv <= 16 ? 1 : lightFruit ? 2 : null;
    case "hot": return trad && c === "탁주" && abv <= 8 ? 0 : trad && (c === "과실주" || c === "허니와인") && abv <= 13 ? 1 : trad && c === "리큐르" && abv <= 13 ? 2 : null;
  }
}
/** 이 술이 상황에 맞는 술인지(어느 묶음에든 들면) */
export const drinkFits = (key: RuleKey, d: Pick<Drink, "category" | "abv" | "kind">): boolean => drinkGroup(key, d) !== null;
/** 이 음식이 상황에 맞는 음식인지 */
export function foodFits(key: RuleKey, f: Pick<Food, "name" | "category">): boolean {
  switch (key) {
    case "rain": return f.category === "전" || f.name === "빈대떡";
    case "snow": return f.category === "전" || SOUP.test(f.name);
    case "cold": return SOUP.test(f.name) || f.category === "회" || f.category === "구이" || inSeason("winter", f);
    case "cool": return f.category === "구이" || inSeason("autumn", f);
    case "warm": return f.category === "전" || f.category === "무침" || inSeason("spring", f);
    case "hot": return f.category === "면" || f.category === "회" || inSeason("summer", f);
  }
}

export type SituationPair = {
  p: Pairing; drink: Drink; food: Food; conf: Exclude<Confidence, "estimate">;
  /** 둘 다 맞음 · 음식만 · 술만 */
  fit: "both" | "food" | "drink";
  /** 사는 곳(시·도)의 술 */
  local: boolean;
};
type DS = Pick<Dataset, "drinks" | "foods" | "pairings">;
const CONF_RANK: Record<Confidence, number> = { confirmed: 2, weak: 1, estimate: 0 };
const regionSido = (d: Drink) => d.region.split(" ")[0] ?? "";

/**
 * 상황에 맞는 조합 n개(홈 칸). 근거 확인·약함 조합만(추정 제외), 술과 음식이 둘 다 맞는 조합을 먼저,
 * 모자라면 음식만 맞는 조합 → 술만 맞는 조합으로 채운다. 같은 술·같은 음식은 한 번씩만.
 * 같은 묶음 안에서는 사는 곳 술(local) → 근거 확인 → 어울림 점수 순.
 */
export function situationPairs(ds: DS, s: Situation, opts: { sido?: string | null; n?: number } = {}): SituationPair[] {
  const n = opts.n ?? 3, sido = opts.sido ?? s.sido;
  const drink = new Map(ds.drinks.filter((d) => !d.demo).map((d) => [d.id, d]));
  const food = new Map(ds.foods.map((f) => [f.id, f]));
  const rows: SituationPair[] = [];
  for (const p of ds.pairings) {
    const d = drink.get(p.d), f = food.get(p.f);
    if (!d || !f) continue;
    const conf = confidenceOf(p);
    if (conf === "estimate") continue;
    const df = drinkFits(s.key, d), ff = foodFits(s.key, f);
    if (!df && !ff) continue;
    rows.push({ p, drink: d, food: f, conf, fit: df && ff ? "both" : ff ? "food" : "drink", local: !!sido && regionSido(d) === sido });
  }
  const FIT: Record<SituationPair["fit"], number> = { both: 2, food: 1, drink: 0 };
  rows.sort((a, b) => (FIT[b.fit] - FIT[a.fit]) || (Number(b.local) - Number(a.local)) || (CONF_RANK[b.conf] - CONF_RANK[a.conf]) || (pairingScore(b.p) - pairingScore(a.p)));
  return pickAcrossGroups(rows, s.key, n);
}

/**
 * 묶음을 돌아가며 고르기 — 둘 다 맞는 조합을 술 묶음 0·1·2… 차례로 하나씩(각 묶음에서 순서상 앞의 것), 묶음이 다 비면 나머지 조합을 순서대로.
 * 같은 술·같은 음식은 한 번씩.
 */
function pickAcrossGroups(rows: readonly SituationPair[], key: RuleKey, n: number): SituationPair[] {
  const out: SituationPair[] = [], seenD = new Set<string>(), seenF = new Set<string>();
  const ok = (r: SituationPair) => !seenD.has(r.drink.id) && !seenF.has(r.food.id);
  const take = (r: SituationPair) => { out.push(r); seenD.add(r.drink.id); seenF.add(r.food.id); };
  const both = rows.filter((r) => r.fit === "both");
  const groups = [...new Set(both.map((r) => drinkGroup(key, r.drink)).filter((g): g is number => g !== null))].sort((a, b) => a - b);
  let progress = true;
  while (out.length < n && progress) {
    progress = false;
    for (const g of groups) {
      if (out.length >= n) break;
      const r = both.find((x) => drinkGroup(key, x.drink) === g && ok(x));
      if (r) { take(r); progress = true; }
    }
  }
  for (const r of rows) { if (out.length >= n) break; if (ok(r)) take(r); }
  return out;
}

export type SituationFor = {
  /** 이 술(음식) 자체가 오늘 같은 날의 술(음식)인지 */
  self: boolean;
  items: SituationPair[];
};

/**
 * 술 상세용 — 이 술의 근거 있는 조합 가운데 오늘 같은 날의 음식. 없으면 이 술이 오늘 같은 날의 술일 때만
 * 가장 믿을 만한 조합을 보여 주고, 둘 다 아니면 null(칸을 그리지 않는다).
 */
export function situationForDrink(ds: DS, s: Situation, drinkId: string, n = 2): SituationFor | null {
  const d = ds.drinks.find((x) => x.id === drinkId);
  if (!d) return null;
  const self = drinkFits(s.key, d);
  const food = new Map(ds.foods.map((f) => [f.id, f]));
  const rows = ds.pairings.filter((p) => p.d === drinkId && confidenceOf(p) !== "estimate")
    .map((p) => ({ p, f: food.get(p.f)! })).filter((x) => x.f)
    .sort((a, b) => (CONF_RANK[confidenceOf(b.p)] - CONF_RANK[confidenceOf(a.p)]) || (pairingScore(b.p) - pairingScore(a.p)));
  const fits = rows.filter((x) => foodFits(s.key, x.f));
  const pick = fits.length ? fits : self ? rows : [];
  if (!pick.length) return null;
  return { self, items: pick.slice(0, n).map((x) => ({ p: x.p, drink: d, food: x.f, conf: confidenceOf(x.p) as SituationPair["conf"], fit: self && foodFits(s.key, x.f) ? "both" : foodFits(s.key, x.f) ? "food" : "drink", local: false })) };
}
/** 음식 상세용 — 이 음식의 근거 있는 조합 가운데 오늘 같은 날의 술(사는 곳 술 먼저). 대칭 규칙 */
export function situationForFood(ds: DS, s: Situation, foodId: string, n = 2, sido?: string | null): SituationFor | null {
  const f = ds.foods.find((x) => x.id === foodId);
  if (!f) return null;
  const self = foodFits(s.key, f);
  const where = sido ?? s.sido;
  const drink = new Map(ds.drinks.filter((d) => !d.demo).map((d) => [d.id, d]));
  const rows = ds.pairings.filter((p) => p.f === foodId && confidenceOf(p) !== "estimate")
    .map((p) => ({ p, d: drink.get(p.d)! })).filter((x) => x.d)
    .sort((a, b) => (Number(!!where && regionSido(b.d) === where) - Number(!!where && regionSido(a.d) === where)) || (CONF_RANK[confidenceOf(b.p)] - CONF_RANK[confidenceOf(a.p)]) || (pairingScore(b.p) - pairingScore(a.p)));
  const fits = rows.filter((x) => drinkFits(s.key, x.d));
  const pick = fits.length ? fits : self ? rows : [];
  if (!pick.length) return null;
  const pairs: SituationPair[] = pick.map((x) => ({ p: x.p, drink: x.d, food: f, conf: confidenceOf(x.p) as SituationPair["conf"], fit: self && drinkFits(s.key, x.d) ? "both" : drinkFits(s.key, x.d) ? "drink" : "food", local: !!where && regionSido(x.d) === where }));
  // 술 묶음을 돌아가며(같은 음식이라 음식 중복 검사는 의미 없음 — 술만 한 번씩)
  return { self, items: pickAcrossGroups(pairs.map((r, i) => ({ ...r, food: { ...f, id: `${f.id}#${i}` } })), s.key, n).map((r) => ({ ...r, food: f })) };
}
