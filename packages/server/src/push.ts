/**
 * 웹 푸시(VAPID) — 손님(페어링GO)·파트너(파트너 앱) 기기 구독 저장과 발송.
 * 키: VAPID_PUBLIC_KEY·VAPID_PRIVATE_KEY·VAPID_SUBJECT(mailto:…). 브라우저에는 공개 키만(NEXT_PUBLIC_VAPID_PUBLIC_KEY).
 * 아이폰은 홈 화면에 추가한 PWA에서만 받는다(iOS 16.4+). 만료된 구독(404·410)은 지운다.
 */
import webpush from "web-push";
import { db } from "./db";

export type PushOwner = "user" | "partner";
export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:kic3403@gmail.com", pub!, priv!);
  return configured;
}

export type SubscriptionInput = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

export async function saveSubscription(owner: PushOwner, ownerId: string, sub: SubscriptionInput, userAgent = ""): Promise<void> {
  const c = db();
  if (!c) throw new Error("DB가 연결되지 않았어요");
  const endpoint = String(sub?.endpoint ?? ""), p256dh = String(sub?.keys?.p256dh ?? ""), auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) throw new Error("알림 구독 정보가 올바르지 않아요");
  const { error } = await c.from("push_subscriptions").upsert(
    { owner_type: owner, owner_id: ownerId, endpoint, p256dh: p256dh.slice(0, 200), auth: auth.slice(0, 100), user_agent: userAgent.slice(0, 200) },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function removeSubscription(owner: PushOwner, ownerId: string, endpoint: string): Promise<void> {
  await db()?.from("push_subscriptions").delete().eq("owner_type", owner).eq("owner_id", ownerId).eq("endpoint", endpoint);
}

export async function pushTo(owner: PushOwner, ownerId: string, payload: PushPayload): Promise<{ subscriptions: number; sent: number; error?: string }> {
  const c = db();
  if (!c || !pushConfigured()) return { subscriptions: 0, sent: 0 };
  const { data } = await c.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("owner_type", owner).eq("owner_id", ownerId);
  const subs = data ?? [];
  let sent = 0, lastError = "";
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: "high" });
      sent++;
      await c.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      lastError = `${code ?? ""} ${(e as Error).message}`.trim();
      if (code === 404 || code === 410) await c.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return { subscriptions: subs.length, sent, error: lastError || undefined };
}
