/**
 * 휴대폰 번호·문자 인증 규칙 — 예약자 연락처(매장에 전달)와 문자 인증번호.
 * 저장은 숫자만("01012345678"), 화면은 하이픈, 목록·알림 미리보기는 가운데를 가린다.
 */
export const OTP_LENGTH = 6;
/** 인증번호 유효 시간(초) · 틀릴 수 있는 횟수 · 다시 보내기까지 기다리는 시간(초) · 하루 발송 상한(번호당) */
export const OTP_TTL_SEC = 180, OTP_MAX_ATTEMPTS = 5, OTP_RESEND_SEC = 30, OTP_DAILY_MAX = 10;

/** 한국 휴대폰 번호 → 숫자 11자리(010) 또는 10~11자리(011·016~019). 아니면 null. +82도 받는다 */
export function normalizeMobile(raw: string): string | null {
  let d = String(raw ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+82")) d = "0" + d.slice(3);
  else if (d.startsWith("82") && d.length >= 11) d = "0" + d.slice(2);
  d = d.replace(/\D/g, "");
  if (/^010\d{8}$/.test(d)) return d;
  if (/^01[16789]\d{7,8}$/.test(d)) return d;
  return null;
}

/** "01012345678" → "010-1234-5678" */
export function formatMobile(d: string): string {
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

/** "01012345678" → "010-****-5678" */
export function maskMobile(d: string): string {
  if (d.length < 8) return "***";
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

/** 인증번호 형식(숫자 6자리) */
export const otpLooksValid = (code: string) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(String(code ?? "").trim());
