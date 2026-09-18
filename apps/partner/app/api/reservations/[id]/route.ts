import { notifyReservation } from "@pairinggo/server/notify";
import { transitionReservation } from "@pairinggo/server/reservations";
import { RESERVATION_STATUSES, type ReservationStatus } from "@pairinggo/shared";
import { approvedOrError } from "@/lib/partner";

/** 매장 상태 처리 — 착석·완료·노쇼·매장 취소(사유 필수). DB 함수가 이 파트너가 그 매장 소속인지·시각 규칙을 확인한다 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { to?: string; note?: string };
  if (!/^[0-9a-f-]{36}$/.test(id) || !(RESERVATION_STATUSES as readonly string[]).includes(String(b.to))) return Response.json({ error: "잘못된 요청이에요" }, { status: 400 });
  const r = await transitionReservation(id, b.to as ReservationStatus, "store", a.user.id, String(b.note ?? "").slice(0, 100));
  if (!r.ok) return Response.json({ error: r.problem }, { status: 400 });
  if (r.to === "cancelled_by_store") await notifyReservation(id, "cancelled_by_store").catch((e) => console.error("[notify]", (e as Error).message));
  return Response.json({ ok: true });
}
