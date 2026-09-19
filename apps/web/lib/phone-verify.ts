/**
 * 손님 휴대폰 번호 문자 인증(식당 예약에 필요, 2026-09-18).
 * 인증번호 6자리 · 3분 · 5번 틀리면 새로 받기 · 30초 뒤 재발송 · 하루 10번(회원·번호 각각).
 * 번호는 인증에 성공했을 때만 users.phone에 저장한다. 인증번호는 HMAC 해시로만 보관.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { LOGIN_METHOD_LABEL, normalizeMobile, OTP_DAILY_MAX, OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_RESEND_SEC, OTP_TTL_SEC, otpLooksValid } from "@pairinggo/shared";
import { phoneVerifyAvailable, sendSms } from "@pairinggo/server/sms";
import { reportError } from "@pairinggo/server/errors";
import { existingAccountMethods } from "./account";
import { db } from "./db";

const need = () => { const c = db(); if (!c) throw new Error("지금은 인증할 수 없어요"); return c; };
const hash = (userId: string, phone: string, code: string) =>
  createHmac("sha256", process.env.AUTH_SECRET || "pairinggo-dev").update(`${userId}:${phone}:${code}`).digest("base64url");

export type PhoneState = { phone: string | null; verified: boolean; available: boolean };

export async function phoneState(userId: string): Promise<PhoneState> {
  const { data } = await need().from("users").select("phone, phone_verified_at").eq("id", userId).maybeSingle();
  return { phone: (data?.phone as string) ?? null, verified: !!data?.phone_verified_at, available: phoneVerifyAvailable() };
}

export async function startVerification(userId: string, raw: string): Promise<{ ok: true; phone: string } | { ok: false; problem: string }> {
  if (!phoneVerifyAvailable()) return { ok: false, problem: "문자 인증을 준비하고 있어요 — 곧 열려요" };
  const phone = normalizeMobile(raw);
  if (!phone) return { ok: false, problem: "휴대폰 번호를 확인해 주세요(010으로 시작)" };
  const c = need();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [{ data: last }, { count: byUser }, { count: byPhone }] = await Promise.all([
    c.from("phone_verifications").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    c.from("phone_verifications").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    c.from("phone_verifications").select("id", { count: "exact", head: true }).eq("phone", phone).gte("created_at", since),
  ]);
  if (last && Date.now() - new Date(String(last.created_at)).getTime() < OTP_RESEND_SEC * 1000) return { ok: false, problem: `${OTP_RESEND_SEC}초 뒤에 다시 받을 수 있어요` };
  if ((byUser ?? 0) >= OTP_DAILY_MAX || (byPhone ?? 0) >= OTP_DAILY_MAX) return { ok: false, problem: "오늘은 인증번호를 더 받을 수 없어요 — 내일 다시 시도해 주세요" };

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const { error } = await c.from("phone_verifications").insert({ user_id: userId, phone, code_hash: hash(userId, phone, code), expires_at: new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString() });
  if (error) return { ok: false, problem: "잠시 뒤 다시 시도해 주세요" };
  const sent = await sendSms(phone, `[페어링GO] 인증번호 ${code} — ${OTP_TTL_SEC / 60}분 안에 입력해 주세요.`);
  if (!sent.ok) { void reportError("web", "sms/phone-verify", `문자 발송 실패 ${sent.reason} ${sent.error ?? ""}`); return { ok: false, problem: "문자를 보내지 못했어요 — 잠시 뒤 다시 시도해 주세요" }; }
  return { ok: true, phone };
}

export async function confirmVerification(userId: string, code: string): Promise<{ ok: true; phone: string } | { ok: false; problem: string }> {
  if (!otpLooksValid(code)) return { ok: false, problem: `인증번호 ${OTP_LENGTH}자리를 입력해 주세요` };
  const c = need();
  const { data: v } = await c.from("phone_verifications").select("id, phone, code_hash, expires_at, attempts, verified_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!v || v.verified_at) return { ok: false, problem: "인증번호를 먼저 받아 주세요" };
  if (new Date(String(v.expires_at)).getTime() < Date.now()) return { ok: false, problem: "인증번호 시간이 지났어요 — 다시 받아 주세요" };
  if (Number(v.attempts) >= OTP_MAX_ATTEMPTS) return { ok: false, problem: "여러 번 틀렸어요 — 인증번호를 다시 받아 주세요" };
  const expect = Buffer.from(String(v.code_hash)), got = Buffer.from(hash(userId, String(v.phone), code));
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) {
    await c.from("phone_verifications").update({ attempts: Number(v.attempts) + 1 }).eq("id", v.id);
    const left = OTP_MAX_ATTEMPTS - Number(v.attempts) - 1;
    return { ok: false, problem: left > 0 ? `인증번호가 맞지 않아요(${left}번 남음)` : "여러 번 틀렸어요 — 인증번호를 다시 받아 주세요" };
  }
  const now = new Date().toISOString();
  await c.from("phone_verifications").update({ verified_at: now }).eq("id", v.id);
  // 같은 번호를 다른 가입 방법의 계정에서 이미 인증했으면 같은 사람의 두 번째 계정 — 번호 주인임을 확인한 뒤에만 알려 준다
  const dup = await existingAccountMethods({ phone: String(v.phone) }, { id: userId });
  if (dup.length) return { ok: false, problem: `이 번호로 인증한 다른 계정이 있어요. ${dup.map((m) => LOGIN_METHOD_LABEL[m]).join("·")}로 가입한 계정으로 로그인해 주세요.` };
  const { error } = await c.from("users").update({ phone: v.phone, phone_verified_at: now }).eq("id", userId);
  if (error) return { ok: false, problem: "저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  return { ok: true, phone: String(v.phone) };
}
