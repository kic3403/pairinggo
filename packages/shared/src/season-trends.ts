/**
 * 계절별·날씨별 검색 관심 분석 규칙(2026-10-02) — 네이버 데이터랩 검색어 트렌드(월별·일별 0~100 지수)를 받아
 * "어느 달에 어떤 술·음식을 많이 찾는가"를 계절 지수로 바꾼다. 받기·보고서는 packages/db season-trends.ts, 여기는 계산만.
 *
 * 데이터랩 지수는 **한 요청 안에서** 가장 큰 값을 100으로 놓은 상대값이라 묶음끼리 크기를 비교하면 안 된다.
 * 그래서 묶음마다 자기 평균을 100으로 다시 놓은 **계절 지수**(seasonalIndex)로 바꾼다 — 120이면 평소보다 20% 더 찾는 달.
 */

export type TrendPoint = { period: string; ratio: number };   // period "2026-09-01" (월별이면 그 달 1일)
export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASON_OF_MONTH: Record<number, Season> = { 3: "spring", 4: "spring", 5: "spring", 6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn", 11: "autumn", 12: "winter", 1: "winter", 2: "winter" };
export const SEASON_KO: Record<Season, string> = { spring: "봄(3~5월)", summer: "여름(6~8월)", autumn: "가을(9~11월)", winter: "겨울(12~2월)" };

const monthOf = (period: string) => Number(period.slice(5, 7));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * 월별 계절 지수 — 달마다(1~12) 그 달 값들의 평균 ÷ 전체 평균 × 100. 몇 해치가 들어와도 같은 달끼리 평균한다.
 * 전체 평균이 0이면(검색이 거의 없는 말) 모두 0.
 */
export function seasonalIndex(points: readonly TrendPoint[]): Record<number, number> {
  const by = new Map<number, number[]>();
  for (const p of points) { const m = monthOf(p.period); if (m >= 1 && m <= 12) { const a = by.get(m) ?? []; a.push(p.ratio); by.set(m, a); } }
  const all = mean(points.map((p) => p.ratio));
  const out: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) out[m] = all > 0 && by.has(m) ? r1((mean(by.get(m)!) / all) * 100) : 0;
  return out;
}

/** 계절별 평균 지수 — 봄·여름·가을·겨울 */
export function seasonIndex(idx: Record<number, number>): Record<Season, number> {
  const out: Record<Season, number[]> = { spring: [], summer: [], autumn: [], winter: [] };
  for (let m = 1; m <= 12; m++) if (idx[m] > 0) out[SEASON_OF_MONTH[m]].push(idx[m]);
  return { spring: r1(mean(out.spring)), summer: r1(mean(out.summer)), autumn: r1(mean(out.autumn)), winter: r1(mean(out.winter)) };
}

/** 가장 높은 달·낮은 달과 그 차이(배) — "6월 대비 10월 1.4배" */
export function peakTrough(idx: Record<number, number>): { peak: number; trough: number; ratio: number } {
  let peak = 1, trough = 1;
  for (let m = 2; m <= 12; m++) { if (idx[m] > idx[peak]) peak = m; if (idx[m] < idx[trough]) trough = m; }
  return { peak, trough, ratio: idx[trough] > 0 ? r1(idx[peak] / idx[trough]) : 0 };
}

/** 계절 차이가 뚜렷한지 — 최고 달이 최저 달의 1.3배 이상이면 '뚜렷', 1.15배 이상이면 '약간', 그 밖은 '거의 없음' */
export function seasonalityLabel(ratio: number): "뚜렷" | "약간" | "거의 없음" {
  return ratio >= 1.3 ? "뚜렷" : ratio >= 1.15 ? "약간" : "거의 없음";
}

/**
 * 일별 지수를 다른 날짜 열(예: 비 온 날 여부, 기온 구간)로 나눠 평균 — "비 온 날 평균 ÷ 안 온 날 평균".
 * byDay는 날짜("YYYY-MM-DD") → 묶음 이름. 묶음에 날이 7일 미만이면 믿을 수 없어 뺀다.
 */
export function splitByDay(points: readonly TrendPoint[], byDay: ReadonlyMap<string, string>, minDays = 7): Record<string, { days: number; mean: number }> {
  const acc = new Map<string, number[]>();
  for (const p of points) { const g = byDay.get(p.period.slice(0, 10)); if (!g) continue; const a = acc.get(g) ?? []; a.push(p.ratio); acc.set(g, a); }
  const out: Record<string, { days: number; mean: number }> = {};
  for (const [g, xs] of acc) if (xs.length >= minDays) out[g] = { days: xs.length, mean: r1(mean(xs)) };
  return out;
}

/** 기온(℃) → 구간 이름 — 도수 규칙 검증용. 경계는 docs/28 제안과 같다 */
export function tempBand(t: number): "5℃ 미만" | "5~15℃" | "15~25℃" | "25℃ 이상" {
  return t < 5 ? "5℃ 미만" : t < 15 ? "5~15℃" : t < 25 ? "15~25℃" : "25℃ 이상";
}
