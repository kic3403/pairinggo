/**
 * '먹어봤어요' 평가 요약 — 회원이 실제로 먹어 본 조합에 어울렸다 · 보통 · 별로 중 하나를 남긴다.
 *
 * 한 사람의 평가는 주관이지만, 여러 사람의 분포는 사실이다. 다만 적은 수에 휘둘리지 않게 두 가지를 지킨다.
 *  1) 표본 수를 항상 함께 보여 준다 — "12명 중 9명".
 *  2) 비율 대신 순위·판정에는 윌슨 하한(95%)을 쓴다 — 2명 중 2명(100%)이 50명 중 45명(90%)을 앞서지 못한다.
 * 평가가 MIN_N명 미만이면 비율을 말하지 않는다(판정 "아직 적음").
 */
export type RatingValue = "good" | "ok" | "bad";
export const RATING_LABEL: Record<RatingValue, string> = { good: "어울렸다", ok: "보통", bad: "별로" };
export const RATING_VALUES: RatingValue[] = ["good", "ok", "bad"];
export type RatingCounts = { good: number; ok: number; bad: number };

export const MIN_N = 3;

export type RatingSummary = {
  n: number;
  /** '어울렸다' 비율(0~100, 반올림). n이 0이면 null */
  goodPct: number | null;
  /** 윌슨 하한(0~1) — 적은 표본을 보수적으로 */
  lower: number;
  verdict: "none" | "few" | "loved" | "mixed" | "disliked";
  /** 화면 문구 */
  text: string;
};

/** 윌슨 점수 구간 하한 (z=1.96) */
export function wilsonLower(pos: number, n: number, z = 1.96): number {
  if (n <= 0) return 0;
  const p = pos / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (c - m) / d);
}

export function summarizeRatings(c: Partial<RatingCounts> | null | undefined): RatingSummary {
  const good = Math.max(0, c?.good || 0), ok = Math.max(0, c?.ok || 0), bad = Math.max(0, c?.bad || 0);
  const n = good + ok + bad;
  if (!n) return { n, goodPct: null, lower: 0, verdict: "none", text: "아직 평가가 없어요" };
  const goodPct = Math.round((good / n) * 100);
  const lower = wilsonLower(good, n);
  if (n < MIN_N) return { n, goodPct, lower, verdict: "few", text: `먹어본 사람 ${n}명` };
  const badPct = bad / n;
  const verdict = goodPct >= 60 ? "loved" : badPct >= 0.5 ? "disliked" : "mixed";
  const tail = verdict === "loved" ? "어울렸다" : verdict === "disliked" ? "별로라는 평이 많아요" : "호불호가 갈려요";
  return { n, goodPct, lower, verdict, text: verdict === "loved" ? `${n}명 중 ${good}명이 어울렸다(${goodPct}%)` : `${n}명 평가 · ${tail}` };
}
