/**
 * 파트너 앱 간편로그인(카카오·네이버, 2026-09-19) — Auth.js 없이 OAuth 인가 코드 흐름을 직접 돈다(파트너 로그인은 서명 쿠키 방식이라).
 *  start → (카카오·네이버 로그인) → callback: state 확인 → 코드 교환 → 프로필 → 연결된 파트너면 로그인, 아니면 가입 신청으로(대기 쿠키)
 *  mode=link: 로그인한 파트너가 설정 화면에서 자기 계정에 잇는다.
 * 키: AUTH_KAKAO_ID(=카카오 REST API 키)·AUTH_KAKAO_SECRET, AUTH_NAVER_ID·AUTH_NAVER_SECRET — 없으면 그 버튼이 안 보인다.
 * 리다이렉트 URI: {파트너 주소}/api/oauth/{kakao|naver}/callback 을 각 콘솔에 등록해야 한다.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parseKakaoProfile, parseNaverProfile, type OAuthProfile, type OAuthProvider } from "@pairinggo/shared";

export const OAUTH_PROVIDERS: OAuthProvider[] = ["kakao", "naver"];
export const PROVIDER_LABEL: Record<OAuthProvider, string> = { kakao: "카카오", naver: "네이버" };
export const STATE_COOKIE = "pgo_oauth_state", PENDING_COOKIE = "pgo_oauth_pending";

const CONF = {
  kakao: {
    authorize: "https://kauth.kakao.com/oauth/authorize", token: "https://kauth.kakao.com/oauth/token", me: "https://kapi.kakao.com/v2/user/me",
    id: () => process.env.AUTH_KAKAO_ID || process.env.KAKAO_REST_KEY || "", secret: () => process.env.AUTH_KAKAO_SECRET || "",
  },
  naver: {
    authorize: "https://nid.naver.com/oauth2.0/authorize", token: "https://nid.naver.com/oauth2.0/token", me: "https://openapi.naver.com/v1/nid/me",
    id: () => process.env.AUTH_NAVER_ID || "", secret: () => process.env.AUTH_NAVER_SECRET || "",
  },
} as const;

export const isProvider = (p: string): p is OAuthProvider => (OAUTH_PROVIDERS as string[]).includes(p);
export const oauthEnabled = (p: OAuthProvider) => !!(CONF[p].id() && CONF[p].secret());
export const enabledProviders = () => OAUTH_PROVIDERS.filter(oauthEnabled);

/**
 * 요청이 들어온 주소 기준(운영 https://pairinggo-partner.vercel.app · 로컬 http://localhost:3001) — 콘솔에 등록한 리다이렉트 URI와 글자까지 같아야 한다.
 * PARTNER_SITE_URL 같은 설정값은 쓰지 않는다(http·https 한 글자만 달라도 로그인이 실패한다).
 */
export const redirectUri = (req: Request, p: OAuthProvider) => `${new URL(req.url).origin}/api/oauth/${p}/callback`;

/* ---------- 서명 쿠키(위조 방지) ---------- */
const secret = () => process.env.PARTNER_AUTH_SECRET || "";
const sign = (s: string) => createHmac("sha256", secret()).update(`oauth:${s}`).digest("base64url");
function seal(obj: Record<string, unknown>, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...obj, exp: Date.now() + ttlSec * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}
function open<T>(v: string | undefined): (T & { exp: number }) | null {
  if (!v || !secret()) return null;
  const [body, sig] = v.split(".");
  if (!body || !sig) return null;
  const expect = sign(body);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try { const o = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number }; return o.exp > Date.now() ? o : null; } catch { return null; }
}

export type OAuthMode = "login" | "link";
export function newState(p: OAuthProvider, mode: OAuthMode) {
  const state = randomBytes(18).toString("base64url");
  return { state, cookie: seal({ state, p, mode }, 600) };
}
export const readState = (v: string | undefined) => open<{ state: string; p: OAuthProvider; mode: OAuthMode }>(v);

export const sealPending = (prof: OAuthProfile) => seal(prof as unknown as Record<string, unknown>, 900);
export const readPending = (v: string | undefined) => open<OAuthProfile>(v);

export function authorizeUrl(p: OAuthProvider, state: string, redirect: string): string {
  const q = new URLSearchParams({ response_type: "code", client_id: CONF[p].id(), redirect_uri: redirect, state });
  return `${CONF[p].authorize}?${q}`;
}

/** 인가 코드 → 프로필. 실패하면 한국어 이유를 던진다 */
export async function profileFromCode(p: OAuthProvider, code: string, state: string, redirect: string): Promise<OAuthProfile> {
  const c = CONF[p];
  const tr = await fetch(c.token, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: c.id(), client_secret: c.secret(), redirect_uri: redirect, code, state }),
    signal: AbortSignal.timeout(8000),
  });
  const tj = (await tr.json().catch(() => ({}))) as { access_token?: string; error?: string; error_code?: string; error_description?: string };
  if (!tr.ok || !tj.access_token) throw new Error(`${PROVIDER_LABEL[p]} 로그인 확인 실패 ${tj.error_code ?? tj.error ?? tr.status} ${tj.error_description ?? ""}`.trim());
  const mr = await fetch(c.me, { headers: { Authorization: `Bearer ${tj.access_token}` }, signal: AbortSignal.timeout(8000) });
  const mj = await mr.json().catch(() => null);
  const prof = p === "kakao" ? parseKakaoProfile(mj) : parseNaverProfile(mj);
  if (!prof) throw new Error(`${PROVIDER_LABEL[p]} 계정 정보를 받지 못했어요`);
  return prof;
}

export const oauthCookie = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge });
