/**
 * 통계 기록 여부(2026-10-02 사용자 결정) — 로컬 개발 서버는 운영과 같은 DB를 써서, 개발 중 화면 조회·검색이 운영 통계에 섞였다
 * (어드민 '많이 본 상세'에 로컬에서만 보이는 데모 술이 올라옴). 화면 이벤트(events)와 검색 기록(search_logs)은 Vercel 운영 배포에서만 쌓는다.
 * 오류 기록(packages/server/errors.ts)과 같은 기준. 로컬에서 기록까지 시험할 때만 `.env.local`에 STATS_LOG_DEV=1.
 */
export const statsOn = (): boolean => (process.env.NODE_ENV === "production" && !!process.env.VERCEL) || !!process.env.STATS_LOG_DEV;
