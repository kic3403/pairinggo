/**
 * 알림 API(docs/25 §6)
 *   GET  /api/notifications → { notices, activity(로그인 회원만), seenAt, loggedIn }
 *   POST /api/notifications → 활동을 읽은 시각을 지금으로(로그인 회원만). 공지의 읽음은 기기(localStorage)에서 센다
 */
import { NextResponse } from "next/server";
import { listNotices, markNotifSeen, myActivity, notifSeenAt } from "@/lib/notifications";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const uid = await userIdOf(req);
  try {
    const [notices, activity, seenAt] = await Promise.all([listNotices(), uid ? myActivity(uid).catch(() => []) : Promise.resolve([]), uid ? notifSeenAt(uid) : Promise.resolve(null)]);
    return NextResponse.json({ notices, activity, seenAt, loggedIn: !!uid }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ ok: true, seenAt: null }, { headers: NO_STORE });
  try { return NextResponse.json({ ok: true, seenAt: await markNotifSeen(uid) }, { headers: NO_STORE }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE }); }
}
