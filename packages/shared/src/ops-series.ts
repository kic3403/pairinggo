/**
 * 대시보드 그래프의 시간 축(2026-10-02 사용자 요청 — 한눈에 보는 x·y축 그래프).
 * 고른 기간을 칸으로 나눠(하루짜리 기간은 1시간 칸, 그 밖은 하루 칸 — 모두 한국 시간) 칸마다 건수를 센다.
 * 숫자 받기(DB)는 웹 lib/ops-metrics.ts, 그리기(SVG)는 admin/OpsChart.tsx. 여기는 칸 나누기·세기·눈금 계산만.
 */
const KST = 9 * 3600_000;
const HOUR = 3600_000, DAY = 86_400_000;

export type SeriesUnit = "hour" | "day";
/** 칸 하나 — start(ISO, 포함)부터 다음 칸 start 전까지. label은 축에 찍는 글("10/1"·"14시") */
export type SeriesBucket = { start: string; label: string };
export type SeriesAxis = { unit: SeriesUnit; buckets: SeriesBucket[] };

/** 기간 → 칸 목록. 기간이 36시간 이하면 시간 칸, 넘으면 하루 칸. 양 끝 칸은 기간에 걸친 만큼만 세어진다 */
export function seriesAxis(p: { since: string; until: string }): SeriesAxis {
  const a = Date.parse(p.since), b = Date.parse(p.until);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return { unit: "day", buckets: [] };
  const unit: SeriesUnit = b - a <= 36 * HOUR ? "hour" : "day";
  const step = unit === "hour" ? HOUR : DAY;
  // 한국 시간 기준 칸 경계 — 하루 칸은 한국 자정, 시간 칸은 정시
  const first = Math.floor((a + KST) / step) * step - KST;
  const buckets: SeriesBucket[] = [];
  for (let t = first; t < b && buckets.length < 400; t += step) {
    const k = new Date(t + KST);
    buckets.push({ start: new Date(t).toISOString(), label: unit === "hour" ? `${k.getUTCHours()}시` : `${k.getUTCMonth() + 1}/${k.getUTCDate()}` });
  }
  return { unit, buckets };
}

/** 시각(ISO) → 몇 번째 칸인지. 축 밖이면 -1 */
export function bucketIndex(axis: SeriesAxis, iso: string): number {
  if (!axis.buckets.length) return -1;
  const t = Date.parse(iso), first = Date.parse(axis.buckets[0].start);
  if (!Number.isFinite(t) || t < first) return -1;
  const i = Math.floor((t - first) / (axis.unit === "hour" ? HOUR : DAY));
  return i < axis.buckets.length ? i : -1;
}

/** 시각 목록 → 칸마다 건수 */
export function countByBucket(axis: SeriesAxis, times: readonly (string | null | undefined)[]): number[] {
  const out = axis.buckets.map(() => 0);
  for (const t of times) { const i = t ? bucketIndex(axis, t) : -1; if (i >= 0) out[i]++; }
  return out;
}

/** (시각, 묶는 값) 목록 → 칸마다 서로 다른 값의 수 — 방문 세션처럼 한 칸에서 한 번만 세는 것 */
export function distinctByBucket(axis: SeriesAxis, rows: readonly { at: string | null | undefined; key: string | null | undefined }[]): number[] {
  const sets = axis.buckets.map(() => new Set<string>());
  for (const r of rows) { const i = r.at && r.key ? bucketIndex(axis, r.at) : -1; if (i >= 0) sets[i].add(r.key!); }
  return sets.map((s) => s.size);
}

/**
 * 세로축 맨 위 값 — 눈금 네 칸이 모두 정수로 떨어지게 한 칸을 '보기 좋은' 수(1·2·3·5×10ⁿ)로 잡고 그 네 배.
 * 0이면 4(빈 그래프도 눈금이 보이게).
 */
export function niceMax(max: number): number {
  if (!(max > 0)) return 4;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 3, 5, 10].map((m) => m * pow).find((v) => v >= raw) ?? 10 * pow;
  return step * 4;
}
/** 세로축 눈금 — 0부터 맨 위까지 4칸(다섯 줄) */
export const yTicks = (top: number): number[] => [0, 1, 2, 3, 4].map((i) => (top * i) / 4);

/** 가로축에 글자를 찍을 칸 — 많으면 건너뛰어 want개쯤만(처음과 끝은 꼭) */
export function xLabelIndexes(n: number, want = 8): number[] {   // 최근 7일은 걸친 날까지 8칸 — 전부 찍는다
  if (n <= 0) return [];
  if (n <= want) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / (want - 1));
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += step) out.push(i);
  if (n - 1 - out[out.length - 1] < step / 2) out.pop();   // 끝 글자와 너무 붙으면 뺀다
  out.push(n - 1);
  return out;
}

/** 대시보드 그래프 한 벌 — 칸과 줄마다의 값 */
export type OpsSeries = {
  axis: SeriesAxis;
  visitors: number[];   // 방문 세션(칸 안에서 서로 다른 세션)
  views: number[];      // 화면 조회
  searches: number[];   // 검색(결과 없음 포함)
  saves: number[];      // 저장
  newUsers: number[];   // 새 회원
};
export const emptySeries = (p: { since: string; until: string }): OpsSeries => {
  const axis = seriesAxis(p), z = () => axis.buckets.map(() => 0);
  return { axis, visitors: z(), views: z(), searches: z(), saves: z(), newUsers: z() };
};
