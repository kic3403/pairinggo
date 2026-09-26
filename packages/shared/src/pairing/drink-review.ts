/**
 * 술 평가 — 별점 + 한 줄(2026-09-26, docs/25). 비비노·데일리샷처럼 상품 단위로 쌓이는 회원 별점.
 * 회원당 술 하나에 하나(수정·삭제 가능). 근거 점수·어울림 등급에는 섞지 않고 "회원 평가"로 따로 보여 준다.
 * 조합 단위 3단계 평가('먹어봤어요', ratings.ts)와는 다른 것 — 그쪽은 술×음식, 여기는 술 자체.
 */
export const DRINK_REVIEW_BODY_MAX = 140;
/** 평균은 3명부터 — 한두 명의 별점이 곧 그 술의 점수처럼 보이지 않게 */
export const DRINK_REVIEW_MIN_N = 3;
export const DRINK_REVIEWS_PER_DAY = 20;
export const DRINK_REVIEW_LIST_MAX = 20;

const hasLink = (s: string) => /https?:|www\.|\.(?:com|kr|net|io)\b|@/i.test(s);

export function cleanReviewBody(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, DRINK_REVIEW_BODY_MAX);
}

/** 문제가 있으면 안내 문장, 없으면 null */
export function drinkReviewProblem(input: { stars: unknown; body?: unknown }): string | null {
  const s = Number(input.stars);
  if (!Number.isInteger(s) || s < 1 || s > 5) return "별점은 1~5 사이로 골라 주세요.";
  const b = String(input.body ?? "").trim();
  if (b.length > DRINK_REVIEW_BODY_MAX) return `한 줄 평은 ${DRINK_REVIEW_BODY_MAX}자까지예요.`;
  if (hasLink(b)) return "한 줄 평에는 링크나 이메일을 넣을 수 없어요.";
  return null;
}

export type StarSummary = { n: number; avg: number | null; hist: [number, number, number, number, number] };

/** 별점 목록 → 인원·평균(소수 1자리, min 미만이면 null)·분포(1점~5점) */
export function summarizeStars(stars: number[], min = DRINK_REVIEW_MIN_N): StarSummary {
  const hist: StarSummary["hist"] = [0, 0, 0, 0, 0];
  let sum = 0, n = 0;
  for (const s of stars) if (Number.isInteger(s) && s >= 1 && s <= 5) { hist[s - 1]++; sum += s; n++; }
  return { n, avg: n >= min ? Math.round((sum / n) * 10) / 10 : null, hist };
}

/** "★★★★☆" — 화면·읽어 주는 기기 둘 다에 쓸 수 있는 글자 */
export const starGlyphs = (s: number) => "★".repeat(Math.max(0, Math.min(5, s))) + "☆".repeat(5 - Math.max(0, Math.min(5, s)));
