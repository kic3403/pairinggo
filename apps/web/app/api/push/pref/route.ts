/**
 * 푸시 설정(docs/25 §7) — GET { pref, devices } · PATCH { weekly?, activity? } · POST /test 는 test/route.ts
 * 세션은 getToken(첫 화면 로그아웃 판정과 경합하지 않게, docs/13)
 */
import { NextResponse } from "next/server";
import { pushDeviceCount, pushPrefOf, setPushPref } from "@/lib/push-digest";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  const [pref, devices] = await Promise.all([pushPrefOf(uid), pushDeviceCount(uid)]);
  return NextResponse.json({ pref, devices }, { headers: NO_STORE });
}

export async function PATCH(req: Request) {
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  try {
    const cur = await pushPrefOf(uid);
    const b = (await req.json().catch(() => ({}))) as Partial<Record<"weekly" | "activity", unknown>>;
    const pref = await setPushPref(uid, { weekly: "weekly" in b ? b.weekly !== false : cur.weekly, activity: "activity" in b ? b.activity !== false : cur.activity });
    return NextResponse.json({ ok: true, pref }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}
