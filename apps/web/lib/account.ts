/**
 * 이메일 계정 — 가입·로그인 검증. service_role로만 접근한다.
 * 연속 실패 잠금: 10회 실패하면 15분. 비밀번호 해시가 느려도(scrypt) 무차별 대입을 늦추는 장치가 하나는 필요하다.
 */
import { CONSENT_VERSION, cleanNickname, needsConsent, nicknameProblem, profileProblem, type Gender, type Sido } from "@pairinggo/shared";
import { db } from "./db";
import { emailLooksValid, hashPassword, normalizeEmail, passwordProblem, verifyPassword } from "./password";

const MAX_FAILS = 10;
const LOCK_MINUTES = 15;

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정 — 계정 기능은 DB가 필요합니다"); return sb; };

export type SignUpResult = { ok: true; id: string } | { ok: false; error: string };

export type ProfileInput = { gender: Gender; birthDate: string; sido: Sido };

export async function signUpWithEmail(emailRaw: string, password: string, nameRaw: string, profile: ProfileInput): Promise<SignUpResult> {
  const email = normalizeEmail(emailRaw);
  if (!emailLooksValid(email)) return { ok: false, error: "이메일 형식을 확인해 주세요." };
  const bad = nicknameProblem(nameRaw) ?? passwordProblem(password) ?? profileProblem(profile);
  if (bad) return { ok: false, error: bad };
  // 닉네임은 직접 입력(필수) — 예전처럼 이메일 앞부분을 쓰면 공개되는 추천 글에 이메일이 드러난다
  const name = cleanNickname(nameRaw);

  const sb = need();
  const { data: existing } = await sb.from("users").select("id").eq("provider", "email").ilike("email", email).maybeSingle();
  if (existing) return { ok: false, error: "이미 가입된 이메일입니다. 로그인해 주세요." };
  if (await nicknameTaken(name, null)) return { ok: false, error: "이미 쓰고 있는 닉네임이에요. 다른 이름을 입력해 주세요." };

  const { data, error } = await sb
    .from("users")
    .insert({ provider: "email", provider_uid: email, email, name, password_hash: await hashPassword(password), gender: profile.gender, birth_date: profile.birthDate, sido: profile.sido, profile_at: new Date().toISOString(), consent_version: CONSENT_VERSION, consent_at: new Date().toISOString() })
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

/* ---------- 프로필(닉네임·성별·생년월일·시도) — 소셜 로그인 회원은 /profile 에서 채운다 ---------- */
export type ProfileRow = { name: string | null; gender: Gender | null; birthDate: string | null; sido: Sido | null; complete: boolean; consentNeeded: boolean; nicknameNeeded: boolean };
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const sb = db(); if (!sb) return null;
  const { data } = await sb.from("users").select("name,gender,birth_date,sido,consent_version").eq("id", userId).maybeSingle();
  if (!data) return null;
  const name = (data.name as string | null) ?? null;
  return {
    name, gender: (data.gender as Gender) ?? null, birthDate: (data.birth_date as string) ?? null, sido: (data.sido as Sido) ?? null,
    complete: !!(data.gender && data.birth_date && data.sido),
    consentNeeded: needsConsent(data.consent_version as string | null),
    nicknameNeeded: nicknameProblem(name) != null,
  };
}

/** 다른 회원이 이미 쓰는 닉네임인지(대소문자·앞뒤 공백 무시). ilike 와일드카드(% _ \)는 글자 그대로 찾게 이스케이프 */
export async function nicknameTaken(name: string, exceptUserId: string | null): Promise<boolean> {
  const sb = need();
  const pattern = cleanNickname(name).replace(/[\\%_]/g, (c) => "\\" + c);
  let q = sb.from("users").select("id").ilike("name", pattern).limit(1);
  if (exceptUserId) q = q.neq("id", exceptUserId);
  const { data } = await q;
  return !!data?.length;
}

/**
 * 프로필 저장. 닉네임이 바뀌면 회원픽 카드 근거(pairing_evidence.who)에 복사된 옛 닉네임도 함께 바꾼다
 * (근거는 글 id 없이 닉네임·한 줄 글로만 이어져 있어, 안 바꾸면 카드에 옛 이름이 남고 탈퇴 때 지우지도 못한다).
 */
export async function updateProfile(userId: string, p: ProfileInput, nicknameRaw?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const bad = profileProblem(p) ?? (nicknameRaw !== undefined ? nicknameProblem(nicknameRaw) : null);
  if (bad) return { ok: false, error: bad };
  const sb = need();
  const patch: Record<string, unknown> = { gender: p.gender, birth_date: p.birthDate, sido: p.sido, profile_at: new Date().toISOString() };
  let oldName: string | null = null;
  if (nicknameRaw !== undefined) {
    const name = cleanNickname(nicknameRaw);
    const { data: cur } = await sb.from("users").select("name").eq("id", userId).maybeSingle();
    oldName = (cur?.name as string | null) ?? null;
    if (name !== oldName) {
      if (await nicknameTaken(name, userId)) return { ok: false, error: "이미 쓰고 있는 닉네임이에요. 다른 이름을 입력해 주세요." };
      patch.name = name;
    }
  }
  const { error } = await sb.from("users").update(patch).eq("id", userId);
  if (error) return { ok: false, error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  if (typeof patch.name === "string") await renameEvidence(userId, (oldName || "회원").slice(0, 20), patch.name.slice(0, 20));
  return { ok: true };
}

/** 회원픽 카드 근거에 복사된 닉네임 바꾸기 — 근거 행은 닉네임 + 한 줄 글(없으면 null)로 찾는다(member-picks.ts syncPair가 만든 형식, deleteAccount와 같은 대조) */
async function renameEvidence(userId: string, oldNick: string, newNick: string) {
  if (oldNick === newNick) return;
  const sb = need();
  const { data: picks } = await sb.from("member_picks").select("note").eq("user_id", userId);
  for (const p of picks ?? []) {
    const note = p.note as string | null;
    const q = sb.from("pairing_evidence").update({ who: newNick }).eq("tier", "user").eq("who", oldNick);
    await (note ? q.eq("quote", note.slice(0, 120)) : q.is("quote", null));
  }
}

/** 가입 마무리 화면으로 보내야 하는지 — 약관 동의 전이거나, 닉네임이 없거나 규칙에 안 맞을 때(간편가입에서 닉네임 동의를 끈 경우 등). 행이 없으면 false */
export async function setupNeeded(userId: string): Promise<boolean> {
  const p = await getProfile(userId).catch(() => null);
  return !!p && (p.consentNeeded || p.nicknameNeeded);
}

/* ---------- 가입 동의·탈퇴 ---------- */
/** 동의를 받아야 하는 회원인지 — 행이 없으면(탈퇴 뒤 남은 세션) false: 로그인 쪽에서 처리한다 */
export async function consentNeeded(userId: string): Promise<boolean> {
  const sb = db(); if (!sb) return false;
  const { data } = await sb.from("users").select("consent_version").eq("id", userId).maybeSingle();
  return !!data && needsConsent(data.consent_version as string | null);
}
export async function recordConsent(userId: string): Promise<void> {
  const { error } = await need().from("users").update({ consent_version: CONSENT_VERSION, consent_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw new Error(error.message);
}

/**
 * 회원 탈퇴 — 계정과 딸린 데이터를 지운다.
 *  · users 행 삭제 → 저장·먹어봤어요·회원 추천 글·하트는 cascade로 함께 지워진다
 *  · 이벤트·검색 로그는 user_id가 null이 되어 누구 것인지 알 수 없는 통계로만 남는다(0013)
 *  · 회원 추천 사진(Storage)과, 회원픽 카드 근거로 복사된 한 줄 글·닉네임(pairing_evidence)은 따로 지운다
 */
export async function deleteAccount(userId: string): Promise<void> {
  const sb = need();
  const { data: u } = await sb.from("users").select("name").eq("id", userId).maybeSingle();
  if (!u) return;
  const nick = ((u.name as string | null) || "회원").slice(0, 20);
  const { data: picks } = await sb.from("member_picks").select("note").eq("user_id", userId);
  for (const p of picks ?? []) {
    const note = p.note as string | null;
    const q = sb.from("pairing_evidence").delete().eq("tier", "user").eq("who", nick);
    await (note ? q.eq("quote", note.slice(0, 120)) : q.is("quote", null));
  }
  const { data: files } = await sb.storage.from("member-picks").list(userId, { limit: 1000 }).catch(() => ({ data: null }));
  if (files?.length) await sb.storage.from("member-picks").remove(files.map((f) => `${userId}/${f.name}`)).catch(() => null);
  const { error } = await sb.from("users").delete().eq("id", userId);
  if (error) throw new Error(error.message);
}
