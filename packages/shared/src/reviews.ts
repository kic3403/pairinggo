/**
 * 식당 리뷰(2026-09-19 사용자 결정 A: 방문 인증 리뷰만) — 별점 5점 + 글 + 사진.
 *  방문 인증 두 가지: ① 페어링GO 앱 예약으로 방문 완료(사장님이 "완료" 처리) ② 영수증 사진(AI가 상호·날짜·금액을 읽어 이 매장·최근 30일인지 확인,
 *  사진은 저장하지 않고 중복 확인 값만). 방문 한 번에 리뷰 하나(예약 id·영수증 값이 고유), 휴대폰 인증 회원만, 사장님 번호로 인증한 회원은 자기 매장 불가,
 *  신고 3건이면 자동 숨김 → 운영자 검토. 평균 별점은 인증 리뷰(= 모든 리뷰)로만.
 * 대표 사진(파트너 매장 상세 맨 위 사진, 최대 10장)도 여기서 정리한다 — 메뉴 사진과 같은 저장소(menu-photos).
 */
import { cleanMenuImage } from "./menu-items";

export const REVIEW_BODY_MIN = 10, REVIEW_BODY_MAX = 500, REVIEW_PHOTOS_MAX = 5, REVIEW_REPORT_HIDE = 3;
export const RECEIPT_MAX_AGE_DAYS = 30, RECEIPT_READS_PER_DAY = 5, REVIEWS_PER_DAY = 5, STORE_PHOTOS_MAX = 10;
export const REVIEW_PHOTO_BUCKET = "review-photos";

export type ReviewVerifyKind = "reservation" | "receipt";
export const REVIEW_VERIFY_LABEL: Record<ReviewVerifyKind, string> = { reservation: "예약 방문", receipt: "영수증 인증" };

/** 공개 리뷰 한 장 — 회원 id·번호·이메일은 담지 않는다(닉네임만) */
export type PublicReview = {
  id: number; rating: number; body: string; photos: string[]; nickname: string;
  verify: ReviewVerifyKind; visitDate: string; createdAt: string;
};
export type ReviewStats = { count: number; avg: number | null };

const REVIEW_PHOTO_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/review-photos\/[A-Za-z0-9-]{1,64}\/[A-Za-z0-9_-]{1,80}\.(?:jpg|jpeg)$/;
/** 리뷰 사진 주소 — 우리 저장소 review-photos 공개 주소만. 아니면 "" */
export const cleanReviewImage = (v: unknown): string => { const s = String(v ?? "").trim(); return s.length <= 300 && REVIEW_PHOTO_URL.test(s) ? s : ""; };

const hasLink = (s: string) => /https?:|www\.|\.(?:com|kr|net|io)\b/i.test(s);

/** 리뷰 입력 정리 — 별점 1~5 정수, 글 10~500자(링크 금지), 사진 5장까지(우리 저장소만) */
export function cleanReviewInput(raw: { rating?: unknown; body?: unknown; photos?: unknown }): { ok: true; value: { rating: number; body: string; photos: string[] } } | { ok: false; problem: string } {
  const rating = Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, problem: "별점을 골라 주세요" };
  const body = String(raw.body ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (body.length < REVIEW_BODY_MIN) return { ok: false, problem: `리뷰를 ${REVIEW_BODY_MIN}자 이상 적어 주세요` };
  if (body.length > REVIEW_BODY_MAX) return { ok: false, problem: `리뷰는 ${REVIEW_BODY_MAX}자까지예요` };
  if (hasLink(body)) return { ok: false, problem: "리뷰에는 링크를 넣을 수 없어요" };
  const photos = [...new Set((Array.isArray(raw.photos) ? raw.photos : []).map(cleanReviewImage).filter(Boolean))];
  if (photos.length > REVIEW_PHOTOS_MAX) return { ok: false, problem: `사진은 ${REVIEW_PHOTOS_MAX}장까지예요` };
  return { ok: true, value: { rating, body, photos } };
}

/** 매장 대표 사진 — 우리 저장소 주소만, 겹친 것 빼고 10장까지 */
export function cleanStorePhotos(raw: unknown): string[] {
  return [...new Set((Array.isArray(raw) ? raw : []).map(cleanMenuImage).filter(Boolean))].slice(0, STORE_PHOTOS_MAX);
}

/** 평균 별점(소수 한 자리) — 리뷰가 없으면 null */
export function reviewStats(ratings: number[]): ReviewStats {
  const ok = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  return { count: ok.length, avg: ok.length ? Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10 : null };
}

/* ---------- 영수증 인증 ---------- */

/** AI가 영수증에서 읽은 값(없으면 빈값) */
export type ReceiptRead = { isReceipt: boolean; storeName: string; bizNo: string; phone: string; address: string; date: string; time: string; total: number | null; approvalNo: string };

/** 상호 비교용 — 띄어쓰기·괄호·(주)·주식회사·"본점/○○점" 꼬리 떼기 */
export function normPlaceName(s: string): string {
  return String(s ?? "").toLowerCase()
    .replace(/\(주\)|㈜|주식회사|유한회사/g, "")
    .replace(/[()[\]{}·.,'"\-_/\\&]/g, " ")
    .replace(/\s+(본점|[가-힣a-z0-9]{2,8}점)$/u, "") // "둔산점"·"본점"은 떼고 "주점"(한 글자 + 점)은 남긴다
    .replace(/\s+/g, "");
}
const digits = (s: string) => String(s ?? "").replace(/\D/g, "");

/**
 * 영수증이 이 매장 것인가 — 사업자번호가 같거나, 전화번호가 같거나, 상호가 서로 포함 관계(2글자 이상)면 같다고 본다.
 * 카드 영수증은 상호가 법인명·약칭으로 찍히기도 해 셋 중 하나만 맞으면 된다.
 */
export function receiptMatchesPlace(r: Pick<ReceiptRead, "storeName" | "bizNo" | "phone">, place: { name: string; phone?: string | null; bizNo?: string | null }): boolean {
  const rb = digits(r.bizNo), pb = digits(place.bizNo ?? "");
  if (rb.length === 10 && rb === pb) return true;
  const rp = digits(r.phone), pp = digits(place.phone ?? "");
  if (rp.length >= 8 && pp.length >= 8 && rp === pp) return true;
  const a = normPlaceName(r.storeName), b = normPlaceName(place.name);
  if (a.length < 2 || b.length < 2) return false;
  return a.includes(b) || b.includes(a);
}

/** 방문일이 오늘(한국 날짜)부터 30일 안인가 — 미래 날짜는 안 된다 */
export function receiptDateOk(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = Date.parse(`${date}T00:00:00Z`), t = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(t)) return false;
  const days = (t - d) / 86400_000;
  return days >= 0 && days <= RECEIPT_MAX_AGE_DAYS;
}

/** 같은 영수증인지 가리는 값(서버가 해시해 저장) — 상호·날짜·시각·금액·승인번호 */
export function receiptKey(r: Pick<ReceiptRead, "storeName" | "date" | "time" | "total" | "approvalNo">): string {
  return [normPlaceName(r.storeName), r.date, r.time.replace(/\D/g, "").slice(0, 4), r.total ?? "", digits(r.approvalNo)].join("|");
}

/** 영수증 확인 결과 → 안내(통과면 null) */
export function receiptProblem(r: ReceiptRead, place: { name: string; phone?: string | null; bizNo?: string | null }, today: string): string | null {
  if (!r.isReceipt) return "영수증이 아닌 것 같아요 — 상호·날짜·금액이 보이게 영수증을 찍어 주세요";
  if (!r.storeName && !r.phone && !r.bizNo) return "영수증에서 상호를 읽지 못했어요 — 윗부분이 잘 보이게 다시 찍어 주세요";
  if (!receiptMatchesPlace(r, place)) return `이 매장(${place.name}) 영수증이 아닌 것 같아요${r.storeName ? ` — 영수증 상호: ${r.storeName}` : ""}`;
  if (!r.date) return "영수증 날짜를 읽지 못했어요 — 날짜가 보이게 다시 찍어 주세요";
  if (!receiptDateOk(r.date, today)) return `최근 ${RECEIPT_MAX_AGE_DAYS}일 안의 영수증만 인증할 수 있어요(영수증 날짜 ${r.date})`;
  if (r.total == null && !digits(r.approvalNo)) return "영수증 금액을 읽지 못했어요 — 합계가 보이게 다시 찍어 주세요";
  return null;
}
