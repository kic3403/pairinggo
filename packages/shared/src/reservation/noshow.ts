/**
 * 노쇼 제한(2026-09-19, 이용약관 제6조의2) — 최근 90일 안에 노쇼가 2번 이상이면 마지막 노쇼로부터 30일 동안 앱 예약을 막는다.
 * 제한이 끝나도 90일 안의 노쇼가 남아 있으면, 다음 노쇼 한 번으로 다시 30일 막힌다.
 */
export const NO_SHOW_WINDOW_DAYS = 90, NO_SHOW_LIMIT = 2, NO_SHOW_BLOCK_DAYS = 30;
const DAY = 86400_000;

export type NoShowBlock = { blocked: boolean; until: Date | null; recent: number };

/** noShowAts: 이 회원 예약이 노쇼로 처리된 시각들 */
export function noShowBlock(noShowAts: (string | Date)[], now: Date): NoShowBlock {
  const t = now.getTime();
  const recent = noShowAts.map((x) => new Date(x).getTime()).filter((x) => Number.isFinite(x) && x <= t && x > t - NO_SHOW_WINDOW_DAYS * DAY).sort((a, b) => b - a);
  if (recent.length < NO_SHOW_LIMIT) return { blocked: false, until: null, recent: recent.length };
  const until = new Date(recent[0] + NO_SHOW_BLOCK_DAYS * DAY);
  return { blocked: until.getTime() > t, until: until.getTime() > t ? until : null, recent: recent.length };
}

/** 화면 안내 — "10월 18일까지 앱 예약이 제한돼요 …" */
export function noShowMessage(b: NoShowBlock): string | null {
  if (!b.blocked || !b.until) return null;
  const k = new Date(b.until.getTime() + 9 * 3600_000); // 한국 날짜
  return `최근 ${NO_SHOW_WINDOW_DAYS}일 동안 노쇼가 ${b.recent}번 있어 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일까지 앱 예약이 제한돼요. 매장에 전화로 예약해 주세요.`;
}
