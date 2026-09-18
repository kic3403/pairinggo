/** 손님 기기 알림 구독 — 예약 확정·매장 취소·당일 안내. POST {subscription} · DELETE {endpoint} */
import { NextResponse } from "next/server";
import { removeSubscription, saveSubscription, type SubscriptionInput } from "@pairinggo/server/push";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  try {
    const b = (await req.json()) as { subscription?: SubscriptionInput };
    await saveSubscription("user", uid, b.subscription ?? {}, req.headers.get("user-agent") ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

export async function DELETE(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { endpoint?: string };
  await removeSubscription("user", uid, String(b.endpoint ?? ""));
  return NextResponse.json({ ok: true });
}
