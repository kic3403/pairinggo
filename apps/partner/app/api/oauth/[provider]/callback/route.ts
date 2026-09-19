import { cookies } from "next/headers";
import { reportError } from "@pairinggo/server/errors";
import { isProvider, oauthCookie, PENDING_COOKIE, profileFromCode, readState, redirectUri, sealPending, STATE_COOKIE } from "@/lib/oauth";
import { linkIdentity, partnerByIdentity } from "@/lib/partner";
import { COOKIE, cookieOptions, currentPartner, issueToken } from "@/lib/session";

/**
 * 간편로그인 돌아오기 — state 확인 → 코드 교환 → 프로필.
 *  login: 연결된 파트너면 로그인, 아니면 가입 신청으로(대기 쿠키 15분)
 *  link : 로그인한 파트너 계정에 잇고 설정 화면으로
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const jar = await cookies();
  const back = (q: string) => Response.redirect(new URL(q, req.url), 303);
  const st = readState(jar.get(STATE_COOKIE)?.value);
  jar.delete(STATE_COOKIE);
  if (!isProvider(provider) || !st || st.p !== provider || st.state !== url.searchParams.get("state")) return back("/login?error=oauth_state");
  if (url.searchParams.get("error") || !url.searchParams.get("code")) return back(st.mode === "link" ? "/settings?oauth=cancel" : "/login?error=oauth_cancel");

  let prof;
  try { prof = await profileFromCode(provider, url.searchParams.get("code")!, st.state, redirectUri(req, provider)); }
  catch (e) { await reportError("partner", `oauth/${provider}`, e); return back(st.mode === "link" ? "/settings?oauth=fail" : "/login?error=oauth_fail"); }

  if (st.mode === "link") {
    const me = await currentPartner();
    if (!me) return back("/login");
    const r = await linkIdentity(me.id, prof);
    return back(`/settings?oauth=${r}&p=${provider}#account`);
  }
  const found = await partnerByIdentity(provider, prof.uid);
  if (found) {
    jar.set(COOKIE, issueToken(found.id, found.passwordHash), cookieOptions);
    return back("/");
  }
  jar.set(PENDING_COOKIE, sealPending(prof), oauthCookie(900));
  return back(`/signup?social=${provider}`);
}
