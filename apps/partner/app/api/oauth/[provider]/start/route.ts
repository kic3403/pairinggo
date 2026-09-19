import { cookies } from "next/headers";
import { rateLimit } from "@pairinggo/server/kakao";
import { authorizeUrl, isProvider, newState, oauthCookie, oauthEnabled, redirectUri, STATE_COOKIE, type OAuthMode } from "@/lib/oauth";
import { currentPartner } from "@/lib/session";

/** 간편로그인 시작 — ?mode=login(로그인·가입) | link(로그인한 파트너가 계정 잇기) */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const back = (q: string) => Response.redirect(new URL(q, req.url), 303);
  if (!isProvider(provider) || !oauthEnabled(provider)) return back("/login?error=oauth_off");
  if (!rateLimit(req, 20, "oauth-start")) return back("/login?error=oauth_busy");
  const mode: OAuthMode = new URL(req.url).searchParams.get("mode") === "link" ? "link" : "login";
  if (mode === "link" && !(await currentPartner())) return back("/login");
  const { state, cookie } = newState(provider, mode);
  (await cookies()).set(STATE_COOKIE, cookie, oauthCookie(600));
  return Response.redirect(authorizeUrl(provider, state, redirectUri(req, provider)), 303);
}
