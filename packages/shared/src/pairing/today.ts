/**
 * 오늘의 페어링(2026-09-27 사용자 결정 — '핫한 페어링'과 따로). 날마다 바뀌는 추천 한 조합 + 곁들이.
 *   핫한 페어링 = 최근 30일 사람들이 많이 본 조합(인기, lib/hot.ts)
 *   오늘의 페어링 = 근거가 확인된 조합 가운데 날짜로 고른 한 조합(추천) — 계절 제철 음식이 들어간 조합을 그 계절 앞쪽에 먼저 돌린다.
 * 고르는 법: 후보 = 근거 확인(confidence confirmed) 조합 전부. 계절(봄 3~5월·여름 6~8·가을 9~11·겨울 12~2) 제철 음식 조합을 앞에,
 *   나머지를 뒤에 두고 각각 '계절+조합' 해시로 섞는다. 그 계절 시작일부터 며칠째인지로 차례대로 하나 — 후보 수만큼은 겹치지 않는다.
 * 같은 날짜면 누구에게나 같은 조합(서버·캐시·공유 링크가 어긋나지 않게). 날씨는 쓰지 않는다(외부 호출 없음).
 */
import type { Dataset, Pairing } from "../types";
import { josa } from "../hangul";
import { confidenceOf } from "./confidence";
import { gradeOf, pairingScore } from "./score";

export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASON_LABEL: Record<Season, string> = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
/** 계절 제철·계절에 잘 먹는 음식(카탈로그 음식 이름 그대로) */
export const SEASON_FOODS: Record<Season, string[]> = {
  spring: ["쭈꾸미볶음", "미나리초무침", "나물무침", "멍게", "도토리묵무침", "바지락칼국수", "회무침", "꼬막무침", "새우장", "월남쌈"],
  summer: ["평양냉면", "막국수", "비빔국수", "물회", "백숙", "장어구이", "광어회", "회무침", "후라이드치킨", "양념치킨", "카프레제", "제철 과일", "월남쌈", "닭강정"],
  autumn: ["대하구이", "버섯구이", "곶감", "해물파전", "김치전", "감자전", "빈대떡", "육전", "굴비", "고등어구이", "떡갈비", "갈비찜", "조개구이", "구운 견과", "간장게장", "전복버터구이", "오리구이"],
  winter: ["굴전", "생굴", "방어회", "과메기", "대게찜", "아귀찜", "대구탕", "어묵탕", "두부전골", "샤브샤브", "모츠나베", "부대찌개", "감자탕", "돼지국밥", "갈비탕", "호떡", "꼬막무침", "홍합탕", "스키야키", "김치찌개"],
};
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
}
/** 그 계절 시작일(YYYY-MM-DD) — 겨울은 12월 1일(1·2월이면 지난해 12월) */
export function seasonStart(date: string): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const s = seasonOf(date);
  const sm = s === "spring" ? 3 : s === "summer" ? 6 : s === "autumn" ? 9 : 12;
  return `${s === "winter" && m < 3 ? y - 1 : y}-${String(sm).padStart(2, "0")}-01`;
}
const dayNo = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
export const weekdayKo = (date: string) => WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** FNV-1a 32비트 — 섞기용(보안 아님) */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export type TodayPick = {
  date: string; season: Season; weekday: string;
  main: Pairing; seasonal: boolean;
  /** 화면 머리 한 줄 — "가을 제철 대하구이와 함께" / "토요일의 추천" */
  headline: string;
  /** 같은 술에 어울리는 다른 음식 · 같은 음식에 어울리는 다른 술(근거 있는 것 먼저, 3개씩) */
  alsoFoods: Pairing[]; alsoDrinks: Pairing[];
  /** 후보 수(근거 확인 조합) · 그중 이번 계절 제철 조합 수 */
  pool: number; seasonalPool: number;
};

type DS = Pick<Dataset, "pairings" | "foods">;

/** 그 계절의 후보 차례 — 제철 조합 먼저, 각각 해시로 섞음 */
function orderFor(ds: DS, season: Season) {
  const foodName = new Map(ds.foods.map((f) => [f.id, f.name]));
  const seasonal = new Set(SEASON_FOODS[season]);
  const pool = ds.pairings.filter((p) => confidenceOf(p) === "confirmed" && foodName.has(p.f));
  const key = (p: Pairing) => hash(`${season}|${p.d}|${p.f}`);
  const isSeasonal = (p: Pairing) => seasonal.has(foodName.get(p.f) ?? "");
  const first = pool.filter(isSeasonal).sort((a, b) => key(a) - key(b));
  const rest = pool.filter((p) => !isSeasonal(p)).sort((a, b) => key(a) - key(b));
  return { list: [...first, ...rest], seasonalCount: first.length, foodName };
}

const rankRel = (rows: Pairing[]) => [...rows]
  .sort((a, b) => ({ confirmed: 2, weak: 1, estimate: 0 }[confidenceOf(b)] - { confirmed: 2, weak: 1, estimate: 0 }[confidenceOf(a)]) || pairingScore(b) - pairingScore(a))
  .filter((p) => gradeOf(p).key !== "try" || confidenceOf(p) !== "estimate");

/** 날짜(KST YYYY-MM-DD)의 오늘의 페어링 — 후보가 없으면 null */
export function todayPick(ds: DS, date: string): TodayPick | null {
  const season = seasonOf(date);
  const { list, seasonalCount, foodName } = orderFor(ds, season);
  if (!list.length) return null;
  const idx = ((dayNo(date) - dayNo(seasonStart(date))) % list.length + list.length) % list.length;
  const main = list[idx];
  const seasonal = idx < seasonalCount;
  const food = foodName.get(main.f) ?? "";
  const weekday = weekdayKo(date);
  const headline = seasonal ? `${SEASON_LABEL[season]} 제철 ${josa(food, "과/와")} 함께` : weekday === "금" ? "불금의 추천" : weekday === "토" || weekday === "일" ? "주말의 추천" : `${weekday}요일의 추천`;
  const alsoFoods = rankRel(ds.pairings.filter((p) => p.d === main.d && p.f !== main.f)).slice(0, 3);
  const alsoDrinks = rankRel(ds.pairings.filter((p) => p.f === main.f && p.d !== main.d)).slice(0, 3);
  return { date, season, weekday, main, seasonal, headline, alsoFoods, alsoDrinks, pool: list.length, seasonalPool: seasonalCount };
}

/** 지난 며칠의 오늘의 페어링(오늘 제외, 최근부터) */
export function recentTodayPicks(ds: DS, date: string, days = 6): { date: string; main: Pairing }[] {
  const out: { date: string; main: Pairing }[] = [];
  const base = Date.parse(`${date}T00:00:00Z`);
  for (let i = 1; i <= days; i++) {
    const d = new Date(base - i * 86400000).toISOString().slice(0, 10);
    const t = todayPick(ds, d);
    if (t) out.push({ date: d, main: t.main });
  }
  return out;
}
