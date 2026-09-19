/**
 * 간편로그인 프로필 정리(2026-09-19, 파트너 앱 카카오·네이버 로그인).
 *  · 카카오 GET kapi.kakao.com/v2/user/me → { id, kakao_account: { email, profile: { nickname }, name, phone_number: "+82 10-1234-5678" } }
 *  · 네이버 GET openapi.naver.com/v1/nid/me → { resultcode: "00", response: { id, email, name, mobile: "010-1234-5678" } }
 * 동의하지 않은 항목은 없을 수 있다 — 빈 값은 null. 휴대폰은 010… 숫자만으로.
 */
import { normalizeMobile } from "./reservation/phone";

export type OAuthProvider = "kakao" | "naver";
export type OAuthProfile = { provider: OAuthProvider; uid: string; email: string | null; name: string | null; phone: string | null };

const str = (v: unknown, max = 80) => { const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max); return s || null; };
const email = (v: unknown) => { const s = str(v, 120)?.toLowerCase() ?? null; return s && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null; };

export function parseKakaoProfile(j: unknown): OAuthProfile | null {
  const o = (j ?? {}) as { id?: unknown; kakao_account?: { email?: unknown; is_email_verified?: unknown; name?: unknown; phone_number?: unknown; profile?: { nickname?: unknown } } };
  const uid = o.id == null ? null : String(o.id);
  if (!uid || !/^\d+$/.test(uid)) return null;
  const a = o.kakao_account ?? {};
  return {
    provider: "kakao", uid,
    // 카카오 이메일은 인증된 것만 믿는다
    email: a.is_email_verified === false ? null : email(a.email),
    name: str(a.name, 20) ?? str(a.profile?.nickname, 20),
    phone: a.phone_number ? normalizeMobile(String(a.phone_number)) : null,
  };
}

export function parseNaverProfile(j: unknown): OAuthProfile | null {
  const o = (j ?? {}) as { resultcode?: unknown; response?: { id?: unknown; email?: unknown; name?: unknown; nickname?: unknown; mobile?: unknown } };
  if (o.resultcode !== "00" || !o.response?.id) return null;
  const r = o.response;
  return {
    provider: "naver", uid: String(r.id).slice(0, 100),
    email: email(r.email), name: str(r.name, 20) ?? str(r.nickname, 20),
    phone: r.mobile ? normalizeMobile(String(r.mobile)) : null,
  };
}
