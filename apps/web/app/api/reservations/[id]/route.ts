/** 내 예약 취소 — 방문 1시간 전까지(DB 함수가 본인 예약인지·시각을 한 번 더 확인) */
import { NextResponse } from "next/server";
import { transitionReservation } from "@pairinggo/server/reservations";
import { auth } from "@/auth";
import { notifyReservation } from "@/lib/reservation-notify";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "예약을 찾을 수 없어요" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { reason?: string };
  const r = await transitionReservation(id, "cancelled_by_user", "user", uid, String(b.reason ?? "").slice(0, 100));
  if (!r.ok) return NextResponse.json({ error: r.problem }, { status: 400 });
  await notifyReservation(id, "cancelled_by_user").catch((e) => console.error("[notify]", (e as Error).message));
  return NextResponse.json({ ok: true });
}
