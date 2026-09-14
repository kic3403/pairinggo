/**
 * GET /api/account/consent → { needed } — 로그인 회원이 가입 마무리(약관 동의 또는 닉네임)를 해야 하는지. SavedProvider가 화면마다 확인해 /profile(가입 마무리)로 보낸다.
 * 페이지 로드 때 불리므로 auth() 대신 getToken()(세션 쿠키를 다시 쓰지 않는다 — 첫 화면 로그아웃과 경합 방지).
 */
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { setupNeeded } from "@/lib/account";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  let uid: string | null = null;
  try {
    const secure = new URL(req.url).protocol === "https:";
    const t = await getToken({ req, secret: process.env.AUTH_SECRET ?? "", secureCookie: secure, salt: secure ? "__Secure-authjs.session-token" : "authjs.session-token" });
    uid = typeof t?.uid === "string" ? t.uid : null;
  } catch { uid = null; }
  if (!uid) return NextResponse.json({ needed: false, loggedIn: false }, { headers: NO_STORE });
  try { return NextResponse.json({ needed: await setupNeeded(uid), loggedIn: true }, { headers: NO_STORE }); }
  catch { return NextResponse.json({ needed: false, loggedIn: true }, { headers: NO_STORE }); }
}
