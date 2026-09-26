/**
 * 없는 술 추가 요청(2026-09-26, docs/25 §5) — 검색 결과가 없거나 라벨 사진으로도 못 찾았을 때 사용자가 남긴다.
 * 비비노의 "라벨을 찍으면 무조건 찾아진다"에 대응하는 우리 입구: 못 찾으면 요청 → 운영자가 넣고 → 요청자에게 알린다(마이페이지).
 */
export const DRINK_REQUEST_QUERY_MAX = 60, DRINK_REQUEST_MEMO_MAX = 140, DRINK_REQUESTS_PER_DAY = 10;
export type DrinkRequestStatus = "open" | "done" | "rejected";
export const DRINK_REQUEST_STATUS_LABEL: Record<DrinkRequestStatus, string> = { open: "확인 중", done: "등록됨", rejected: "보류" };

const hasLink = (s: string) => /https?:|www\.|\.(?:com|kr|net|io)\b|@/i.test(s);
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function cleanDrinkRequest(input: { query: unknown; memo?: unknown }): { query: string; memo: string } {
  return { query: clean(input.query, DRINK_REQUEST_QUERY_MAX), memo: clean(input.memo, DRINK_REQUEST_MEMO_MAX) };
}

/** 문제가 있으면 안내 문장, 없으면 null */
export function drinkRequestProblem(input: { query: unknown; memo?: unknown }): string | null {
  const { query, memo } = cleanDrinkRequest(input);
  if (query.length < 2) return "술 이름을 두 글자 이상 적어 주세요.";
  if (String(input.query ?? "").trim().length > DRINK_REQUEST_QUERY_MAX) return `술 이름은 ${DRINK_REQUEST_QUERY_MAX}자까지예요.`;
  if (hasLink(query) || hasLink(memo)) return "링크나 이메일은 넣을 수 없어요.";
  if (String(input.memo ?? "").trim().length > DRINK_REQUEST_MEMO_MAX) return `메모는 ${DRINK_REQUEST_MEMO_MAX}자까지예요.`;
  return null;
}

/** 마이페이지 한 줄 — "등록됨 · 한산소곡주 →" / "확인 중" / "보류 · 사유" */
export function drinkRequestStatusText(r: { status: DrinkRequestStatus; drinkName?: string | null; adminNote?: string | null }): string {
  if (r.status === "done") return r.drinkName ? `등록됨 · ${r.drinkName}` : "등록됨";
  if (r.status === "rejected") return r.adminNote ? `보류 · ${r.adminNote}` : "보류";
  return "확인 중";
}
