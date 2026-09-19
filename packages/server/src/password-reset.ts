/**
 * 비밀번호 재설정 — 휴대폰 문자 인증(2026-09-19). 페어링GO 이메일 회원과 파트너 계정이 함께 쓴다.
 *  1) start: 이메일(계정) + 휴대폰 번호 → 계정에 등록된 번호와 같을 때만 인증번호 문자. 계정이 있는지는 드러내지 않는다
 *  2) confirm: 인증번호 + 새 비밀번호 → 저장(save는 각 앱이 넘긴다)
 * 인증번호 6자리 · 3분 · 5번 틀리면 새로 받기 · 30초 뒤 재발송 · 계정당 하루 5번. 기록은 아침 크론이 하루 뒤 지운다.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { normalizeMobile, OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_RESEND_SEC, OTP_TTL_SEC, otpLooksValid } from "@pairinggo/shared";
import { db } from "./db";
import { hashPassword, passwordProblem } from "./password";
import { phoneVerifyAvailable, sendSms } from "./sms";

export type ResetKind = "user" | "partner";
/** 재설정 대상 계정 — 없거나 번호가 없으면 null */
export type ResetAccount = { id: string; phone: string | null } | null;
export type ResetResult = { ok: true } | { ok: false; problem: string };

export const RESET_DAILY_MAX = 5;
const need = () => { const c = db(); if (!c) throw new Error("지금은 재설정할 수 없어요"); return c; };
const secret = () => process.env.PASSWORD_RESET_SECRET || process.env.AUTH_SECRET || process.env.PARTNER_AUTH_SECRET || "pairinggo-dev";
const hash = (kind: ResetKind, id: string, phone: string, code: string) => createHmac("sha256", secret()).update(`reset:${kind}:${id}:${phone}:${code}`).digest("base64url");

export async function startPasswordReset(kind: ResetKind, account: ResetAccount, phoneRaw: string): Promise<ResetResult> {
  if (!phoneVerifyAvailable()) return { ok: false, problem: "문자 인증을 준비하고 있어요 — 문의 이메일로 알려 주세요" };
  const phone = normalizeMobile(phoneRaw);
  if (!phone) return { ok: false, problem: "휴대폰 번호를 확인해 주세요(010으로 시작)" };
  // 계정이 없거나 번호가 다르면 보내지 않지만, 화면에는 같은 안내를 보여 준다(가입 여부를 알려 주지 않기 위해)
  if (!account || account.phone !== phone) return { ok: true };
  const c = need();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [{ data: last }, { count }] = await Promise.all([
    c.from("password_resets").select("created_at").eq("account_type", kind).eq("account_id", account.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    c.from("password_resets").select("id", { count: "exact", head: true }).eq("account_type", kind).eq("account_id", account.id).gte("created_at", since),
  ]);
  if (last && Date.now() - new Date(String(last.created_at)).getTime() < OTP_RESEND_SEC * 1000) return { ok: false, problem: `${OTP_RESEND_SEC}초 뒤에 다시 받을 수 있어요` };
  if ((count ?? 0) >= RESET_DAILY_MAX) return { ok: false, problem: "오늘은 인증번호를 더 받을 수 없어요 — 내일 다시 시도해 주세요" };
  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const { error } = await c.from("password_resets").insert({ account_type: kind, account_id: account.id, phone, code_hash: hash(kind, account.id, phone, code), expires_at: new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString() });
  if (error) return { ok: false, problem: "잠시 뒤 다시 시도해 주세요" };
  const sent = await sendSms(phone, `[페어링GO${kind === "partner" ? " 파트너" : ""}] 비밀번호 재설정 인증번호 ${code} — ${OTP_TTL_SEC / 60}분 안에 입력해 주세요. 요청하지 않았다면 무시하세요.`);
  if (!sent.ok) return { ok: false, problem: "문자를 보내지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  return { ok: true };
}

export async function confirmPasswordReset(kind: ResetKind, account: ResetAccount, code: string, newPassword: string, save: (id: string, passwordHash: string) => Promise<void>): Promise<ResetResult> {
  if (!otpLooksValid(code)) return { ok: false, problem: `인증번호 ${OTP_LENGTH}자리를 입력해 주세요` };
  const pwp = passwordProblem(newPassword);
  if (pwp) return { ok: false, problem: pwp };
  const wrong = { ok: false as const, problem: "인증번호가 맞지 않아요 — 이메일·번호를 확인하고 다시 받아 주세요" };
  if (!account?.phone) return wrong;
  const c = need();
  const { data: r } = await c.from("password_resets").select("id, phone, code_hash, expires_at, attempts, used_at")
    .eq("account_type", kind).eq("account_id", account.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!r || r.used_at || r.phone !== account.phone) return wrong;
  if (new Date(String(r.expires_at)).getTime() < Date.now()) return { ok: false, problem: "인증번호 시간이 지났어요 — 다시 받아 주세요" };
  if (Number(r.attempts) >= OTP_MAX_ATTEMPTS) return { ok: false, problem: "여러 번 틀렸어요 — 인증번호를 다시 받아 주세요" };
  const expect = Buffer.from(String(r.code_hash)), got = Buffer.from(hash(kind, account.id, account.phone, code));
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) {
    await c.from("password_resets").update({ attempts: Number(r.attempts) + 1 }).eq("id", r.id);
    return wrong;
  }
  await c.from("password_resets").update({ used_at: new Date().toISOString() }).eq("id", r.id);
  await save(account.id, await hashPassword(newPassword));
  return { ok: true };
}
