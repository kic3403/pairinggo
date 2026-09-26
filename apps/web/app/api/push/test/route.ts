/** 시험 알림(docs/25 §7) — 로그인한 회원의 알림을 켠 기기 전부에 한 번. 분당 3번 */
import { NextResponse } from "next/server";
import { pushConfigured, pushTo } from "@pairinggo/server/push";
import { rateLimit } from "@/lib/kakao";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const uid = await userIdOf(req);
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  if (!rateLimit(req, 3, "push-test")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요." }, { status: 429, headers: NO_STORE });
  if (!pushConfigured()) return NextResponse.json({ error: "푸시가 아직 설정되지 않았어요." }, { status: 503, headers: NO_STORE });
  const r = await pushTo("user", uid, { title: "페어링GO 알림이 켜졌어요", body: "주간 소식과 활동 소식을 여기로 보내 드려요.", url: "/my", tag: "test" });
  return NextResponse.json({ ok: r.sent > 0, sent: r.sent, subscriptions: r.subscriptions, error: r.error }, { headers: NO_STORE });
}
