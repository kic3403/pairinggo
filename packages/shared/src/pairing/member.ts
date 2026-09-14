/**
 * 회원 추천 페어링 규칙 (2026-09-13 → 2026-09-14 개정, 사용자 결정)
 *  - 회원이 "이 술엔 이 음식" 글을 올리면 **바로** 회원 추천 목록에 보인다. 다른 회원이 하트(♥)를 눌러 공감하고, 목록은 하트 많은 순.
 *  - 같은 조합에 글이 MEMBER_PICK_MIN건 모이거나, 한 글이 하트 MEMBER_PICK_LIKES_MIN개를 받으면 pairings에 src 'user'(회원픽) 카드가 생긴다
 *    — 전문가 85·보너스 +0.5(블로그 후기와 같은 급), 근거 링크 보너스는 없다.
 *  - 카탈로그에 없는 술/음식을 적으면 검수(review) 뒤 게시. 글은 140자, 사진 1장, 닉네임만 노출. 회원당 하루 MEMBER_PICK_DAILY건.
 */
export const MEMBER_PICK_MIN = 2;          // 같은 조합 글 수 — 지인 배포 초기 2, 회원이 늘면 3
export const MEMBER_PICK_LIKES_MIN = 3;    // 한 글의 하트 수 — 이만큼 받으면 회원픽 카드
export const MEMBER_PICK_NOTE_MAX = 140;
export const MEMBER_PICK_DAILY = 5;
export const MEMBER_PICK_ES = 85;
export const MEMBER_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const MEMBER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type MemberPickStatus = "active" | "review" | "hidden";

/** 마이페이지 상태 문구 — n은 같은 조합의 글 수(본인 포함), likes는 이 글의 하트 수 */
export function memberPickStatusText(status: MemberPickStatus, n: number, likes = 0, min = MEMBER_PICK_MIN, likesMin = MEMBER_PICK_LIKES_MIN): string {
  if (status === "hidden") return "운영자가 숨겼어요";
  if (status === "review") return "검수 중 — 카탈로그에 없는 술·음식은 확인 뒤 게시돼요";
  const heart = `하트 ${likes}`;
  if (n >= min || likes >= likesMin) return `게시됨 · ${heart} · 페어링 카드에도 올라갔어요`;
  return `게시됨 · ${heart} · 하트 ${likesMin - likes}개를 더 받거나 같은 조합 글이 ${min - n}개 더 오면 페어링 카드에 올라가요`;
}

/** 카드가 생기는 조건 — 같은 조합 글 수 또는 한 글의 하트 수 */
export function memberPickPublishes(posts: number, maxLikes: number, min = MEMBER_PICK_MIN, likesMin = MEMBER_PICK_LIKES_MIN): boolean {
  return posts >= min || maxLikes >= likesMin;
}

/** 카드 문구 — 조합의 글 수와 하트 합 */
export function memberPickSummary(n: number, likes = 0): string {
  const base = n === 1 ? "회원 1명 추천" : `회원 ${n}명 추천`;
  return likes > 0 ? `${base} · ♥ ${likes}` : base;
}

/** 추천 글 검사 — 빈 글은 허용(선택 입력), 140자 초과·링크는 거부(광고·저작권 회피) */
export function validateMemberNote(note: string): string | null {
  const s = note.trim();
  if (s.length > MEMBER_PICK_NOTE_MAX) return `추천 글은 ${MEMBER_PICK_NOTE_MAX}자까지예요`;
  if (/https?:\/\/|www\./i.test(s)) return "링크는 넣을 수 없어요";
  return null;
}

/**
 * 홈 가운데 "회원이 추천한 페어링" 칸 — 글이 적을 때 큰 자리를 비워 두면 서비스가 비어 보인다(2026-09-15 실측: 글 1·하트 0, docs/20 P0-5).
 * HOME_PICKS_MIN건 이상이면 목록(feed), 그보다 적으면 홈 아래쪽 작은 초대 카드(invite).
 */
export const HOME_PICKS_MIN = 3;
export const homePicksMode = (count: number): "feed" | "invite" => (count >= HOME_PICKS_MIN ? "feed" : "invite");
