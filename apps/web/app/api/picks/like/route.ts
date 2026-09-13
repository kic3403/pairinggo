/**
 * 회원 추천 글 하트
 *   GET  /api/picks/like            → { ids: [내가 하트 누른 글 id], mine: [내 글 id], loggedIn }  (비로그인이면 빈 배열)
 *   POST /api/picks/like { id }     → { liked, likes, published }  토글. 로그인 필수, 내 글은 불가
 */
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { myLikes, myPostIds, toggleLike } from "@/lib/member-picks";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

async function userIdOf(req: Request): Promise<string | null> {
  try {
    const secure = new URL(req.url).protocol === "https:";
    const t = await getToken({ req, secret: process.env.AUTH_SECRET ?? "", secureCookie: secure, salt: secure ? "__Secure-authjs.session-token" : "authjs.session-token" });
    return typeof t?.uid === "string" ? t.uid : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const uid = await userIdOf(req);
  try {
    const [ids, mine] = uid ? await Promise.all([myLikes(uid), myPostIds(uid)]) : [[], []];
    return NextResponse.json({ ids, mine, loggedIn: !!uid }, { headers: NO_STORE });
  }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}

export async function POST(req: Request) {
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (origin && host && !origin.endsWith(`//${host}`)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  const b = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = Number(b?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  try {
    const r = await toggleLike(uid, id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code, headers: NO_STORE });
    return NextResponse.json(r, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}
