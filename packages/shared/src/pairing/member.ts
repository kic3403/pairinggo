/**
 * 회원 추천 페어링 규칙 (2026-09-13, 사용자 결정: "C 집계형을 기본으로, A의 보상을 조금")
 *  - 회원이 "이 술엔 이 음식"을 제안한다. 본인에게는 즉시 보이고(마이페이지), 남에게는 같은 조합에 MEMBER_PICK_MIN명이 모여야 보인다.
 *  - 공개되면 pairings에 src 'user'(회원픽) 행이 생긴다 — 전문가 85·보너스 +0.5(블로그 후기와 같은 급), 근거 링크 보너스는 없다.
 *  - 카탈로그에 없는 술/음식을 적으면 검수(review) 뒤 게시. 글은 140자, 사진 1장, 닉네임만 노출. 회원당 하루 MEMBER_PICK_DAILY건.
 */
export const MEMBER_PICK_MIN = 2;          // 지인 배포 초기 2명, 회원이 늘면 3명으로
export const MEMBER_PICK_NOTE_MAX = 140;
export const MEMBER_PICK_DAILY = 5;
export const MEMBER_PICK_ES = 85;
export const MEMBER_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const MEMBER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type MemberPickStatus = "active" | "review" | "hidden";

/** 마이페이지 상태 문구 — n은 같은 조합을 추천한 회원 수(본인 포함) */
export function memberPickStatusText(status: MemberPickStatus, n: number, min = MEMBER_PICK_MIN): string {
  if (status === "hidden") return "운영자가 숨겼어요";
  if (status === "review") return "검수 중 — 카탈로그에 없는 술·음식은 확인 뒤 게시돼요";
  if (n >= min) return `공개됨 · 회원 ${n}명 추천`;
  return `${min - n}명이 더 추천하면 공개돼요 (${n}/${min})`;
}

/** 카드 문구 — 공개된 조합의 추천 수 */
export function memberPickSummary(n: number): string {
  return n === 1 ? "회원 1명 추천" : `회원 ${n}명 추천`;
}

/** 추천 글 검사 — 빈 글은 허용(선택 입력), 140자 초과·링크는 거부(광고·저작권 회피) */
export function validateMemberNote(note: string): string | null {
  const s = note.trim();
  if (s.length > MEMBER_PICK_NOTE_MAX) return `추천 글은 ${MEMBER_PICK_NOTE_MAX}자까지예요`;
  if (/https?:\/\/|www\./i.test(s)) return "링크는 넣을 수 없어요";
  return null;
}
