import { removeSubscription, saveSubscription, type SubscriptionInput } from "@pairinggo/server/push";
import { partnerOr401 } from "@/lib/session";

/** 이 기기 알림 구독 저장(POST {subscription}) · 해제(DELETE {endpoint}) */
export async function POST(req: Request) {
  const u = await partnerOr401(); if (u instanceof Response) return u;
  try {
    const b = (await req.json()) as { subscription?: SubscriptionInput };
    await saveSubscription("partner", u.id, b.subscription ?? {}, req.headers.get("user-agent") ?? "");
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}

export async function DELETE(req: Request) {
  const u = await partnerOr401(); if (u instanceof Response) return u;
  const b = (await req.json().catch(() => ({}))) as { endpoint?: string };
  await removeSubscription("partner", u.id, String(b.endpoint ?? ""));
  return Response.json({ ok: true });
}
