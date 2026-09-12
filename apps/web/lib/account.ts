/**
 * 이메일 계정 — 가입·로그인 검증. service_role로만 접근한다.
 * 연속 실패 잠금: 10회 실패하면 15분. 비밀번호 해시가 느려도(scrypt) 무차별 대입을 늦추는 장치가 하나는 필요하다.
 */
import { profileProblem, type Gender, type Sido } from "@pairinggo/shared";
import { db } from "./db";
import { emailLooksValid, hashPassword, normalizeEmail, passwordProblem, verifyPassword } from "./password";

const MAX_FAILS = 10;
const LOCK_MINUTES = 15;

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정 — 계정 기능은 DB가 필요합니다"); return sb; };

export type SignUpResult = { ok: true; id: string } | { ok: false; error: string };

export type ProfileInput = { gender: Gender; birthDate: string; sido: Sido };

export async function signUpWithEmail(emailRaw: string, password: string, nameRaw: string | undefined, profile: ProfileInput): Promise<SignUpResult> {
  const email = normalizeEmail(emailRaw);
  if (!emailLooksValid(email)) return { ok: false, error: "이메일 형식을 확인해 주세요." };
  const bad = passwordProblem(password) ?? profileProblem(profile);
  if (bad) return { ok: false, error: bad };
  const name = (nameRaw || email.split("@")[0]).trim().slice(0, 20);

  const sb = need();
  const { data: existing } = await sb.from("users").select("id").eq("provider", "email").ilike("email", email).maybeSingle();
  if (existing) return { ok: false, error: "이미 가입된 이메일입니다. 로그인해 주세요." };

  const { data, error } = await sb
    .from("users")
    .insert({ provider: "email", provider_uid: email, email, name, password_hash: await hashPassword(password), gender: profile.gender, birth_date: profile.birthDate, sido: profile.sido, profile_at: new Date().toISOString() })
    .select("id")
    .single();
  // 동시 가입 경합 — 고유 인덱스가 막아 준다
  if (error) return { ok: false, error: error.code === "23505" ? "이미 가입된 이메일입니다." : "가입에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  return { ok: true, id: data.id as string };
}

export type AccountUser = { id: string; email: string; name: string | null };

/** 로그인 검증 — 성공하면 사용자, 실패하면 null. 이유는 로그인 화면에서 구분하지 않는다(계정 존재 여부 노출 방지) */
export async function verifyEmailLogin(emailRaw: string, password: string): Promise<AccountUser | null> {
  const email = normalizeEmail(emailRaw);
  if (!emailLooksValid(email) || !password) return null;
  const sb = need();
  const { data: u } = await sb.from("users").select("id,email,name,password_hash,failed_attempts,locked_until").eq("provider", "email").ilike("email", email).maybeSingle();
  if (!u) { await verifyPassword(password, null); return null; }          // 없는 계정도 비슷한 시간이 걸리게
  if (u.locked_until && new Date(u.locked_until) > new Date()) return null;

  if (await verifyPassword(password, u.password_hash)) {
    await sb.from("users").update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq("id", u.id);
    return { id: u.id as string, email: u.email as string, name: (u.name as string) ?? null };
  }
  const fails = (u.failed_attempts as number ?? 0) + 1;
  await sb.from("users").update({
    failed_attempts: fails,
    locked_until: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
  }).eq("id", u.id);
  return null;
}

/* ---------- 프로필(성별·생년월일·시도) — 소셜 로그인 회원은 /profile 에서 채운다 ---------- */
export type ProfileRow = { gender: Gender | null; birthDate: string | null; sido: Sido | null; complete: boolean };
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const sb = db(); if (!sb) return null;
  const { data } = await sb.from("users").select("gender,birth_date,sido").eq("id", userId).maybeSingle();
  if (!data) return null;
  return { gender: (data.gender as Gender) ?? null, birthDate: (data.birth_date as string) ?? null, sido: (data.sido as Sido) ?? null, complete: !!(data.gender && data.birth_date && data.sido) };
}
export async function updateProfile(userId: string, p: ProfileInput): Promise<void> {
  const bad = profileProblem(p); if (bad) throw new Error(bad);
  const sb = need();
  const { error } = await sb.from("users").update({ gender: p.gender, birth_date: p.birthDate, sido: p.sido, profile_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw new Error(error.message);
}
