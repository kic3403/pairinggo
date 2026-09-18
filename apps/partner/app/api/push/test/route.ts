import { pushConfigured, pushTo } from "@pairinggo/server/push";
import { partnerOr401 } from "@/lib/session";

/** 시험 알림 — 이 파트너가 알림을 켠 모든 기기로 */
export async function POST() {
  const u = await partnerOr401(); if (u instanceof Response) return u;
  if (!pushConfigured()) return Response.json({ error: "알림 키가 아직 설정되지 않았어요(VAPID)" }, { status: 503 });
  const r = await pushTo("partner", u.id, { title: "시험 알림", body: "새 예약이 들어오면 이렇게 알려 드려요", url: "/", tag: "test" });
  if (!r.subscriptions) return Response.json({ error: "알림을 켠 기기가 없어요" }, { status: 400 });
  return Response.json({ ok: r.sent > 0, sent: r.sent, error: r.sent ? undefined : r.error }, { status: r.sent ? 200 : 502 });
}
