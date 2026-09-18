/**
 * 문자·알림톡 발송 — 솔라피(SOLAPI) 한 업체(2026-09-18 사용자 결정: 문자 인증은 알림톡과 같은 업체).
 * 키·발신번호·카카오 채널·템플릿은 사업자등록 뒤에 생긴다. 그 전에는
 *  · 개발 환경(NODE_ENV≠production): 보내지 않고 서버 로그에 내용을 찍는다(인증번호 확인용)
 *  · 운영 환경: 문자는 보내지 못함(not_configured) → 예약 화면이 "준비 중", 알림톡은 건너뛰고 기록만
 * 인증 방식: Authorization: HMAC-SHA256 apiKey=…, date=…, salt=…, signature=hex(HMAC(secret, date+salt))
 */
import { createHmac, randomBytes } from "node:crypto";

const API = "https://api.solapi.com/messages/v4/send";
const env = () => ({
  key: process.env.SOLAPI_API_KEY || "", secret: process.env.SOLAPI_API_SECRET || "", from: (process.env.SOLAPI_SENDER || "").replace(/\D/g, ""),
  pfId: process.env.SOLAPI_KAKAO_PFID || "",
});
export const isDev = () => process.env.NODE_ENV !== "production";
export const smsConfigured = () => { const e = env(); return !!(e.key && e.secret && e.from); };
/** 문자 인증을 쓸 수 있는가 — 키가 있거나 개발 환경 */
export const phoneVerifyAvailable = () => smsConfigured() || isDev();
export const alimtalkConfigured = () => smsConfigured() && !!env().pfId;

export type SendResult = { ok: true; dev?: boolean } | { ok: false; reason: "not_configured" | "failed"; error?: string };

function authHeader(key: string, secret: string) {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", secret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function send(message: Record<string, unknown>): Promise<SendResult> {
  const e = env();
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: authHeader(e.key, e.secret), "Content-Type": "application/json" },
      body: JSON.stringify({ message: { from: e.from, ...message } }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return { ok: true };
    return { ok: false, reason: "failed", error: `${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}` };
  } catch (err) { return { ok: false, reason: "failed", error: (err as Error).message }; }
}

/** 문자(SMS) — to는 숫자만 휴대폰 번호 */
export async function sendSms(to: string, text: string): Promise<SendResult> {
  if (!smsConfigured()) {
    if (isDev()) { console.log(`[sms 개발] ${to} ← ${text}`); return { ok: true, dev: true }; }
    return { ok: false, reason: "not_configured" };
  }
  return send({ to, text });
}

/** 카카오 알림톡 — 템플릿 id와 변수(#{이름} 형식). 설정 전에는 건너뛴다(개발 환경은 로그) */
export async function sendAlimtalk(to: string, templateId: string, variables: Record<string, string>, fallbackText?: string): Promise<SendResult> {
  if (!alimtalkConfigured() || !templateId) {
    if (isDev()) { console.log(`[알림톡 개발] ${to} ← ${templateId || "(템플릿 없음)"} ${JSON.stringify(variables)}`); return { ok: true, dev: true }; }
    return { ok: false, reason: "not_configured" };
  }
  return send({ to, type: "ATA", kakaoOptions: { pfId: env().pfId, templateId, variables, disableSms: !fallbackText }, ...(fallbackText ? { text: fallbackText } : {}) });
}
