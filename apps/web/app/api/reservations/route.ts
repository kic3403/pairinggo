/** 내 예약 — GET 목록 · POST 예약(즉시 확정). 로그인 + 휴대폰 인증 + 최신 약관 동의 + 예약마다 매장 제공 동의 */
import { NextResponse } from "next/server";
import { noShowMessage, type ReservationRequestInput } from "@pairinggo/shared";
import { bookingContextByKakao, createReservation, noShowState } from "@pairinggo/server/reservations";
import { reportError } from "@pairinggo/server/errors";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/kakao";
import { myReservations, reserverState } from "@/lib/reservations";
import { notifyReservation } from "@/lib/reservation-notify";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401, headers: NO_STORE });
  return NextResponse.json({ items: await myReservations(uid) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (!rateLimit(req, 10, "reserve")) return NextResponse.json({ error: "요청이 너무 많아요 — 1분 뒤 다시 시도해 주세요" }, { status: 429 });
  const me = await reserverState(uid);
  if (!me.consentOk) return NextResponse.json({ error: "바뀐 약관에 먼저 동의해 주세요", need: "consent" }, { status: 403 });
  const ns = await noShowState(uid);
  if (ns.blocked) return NextResponse.json({ error: noShowMessage(ns), need: "noshow" }, { status: 403 });
  if (!me.verified || !me.phone) return NextResponse.json({ error: "휴대폰 번호를 먼저 인증해 주세요", need: "phone" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as ReservationRequestInput & { kakaoId?: string };
  const ctx = await bookingContextByKakao(String(b.kakaoId ?? ""));
  if (!ctx) return NextResponse.json({ error: "예약할 수 없는 매장이에요" }, { status: 404 });
  const r = await createReservation({ ctx, userId: uid, guestPhone: me.phone, input: b });
  if (!r.ok) return NextResponse.json({ error: r.problem }, { status: 409 });
  // 알림(매장 푸시·알림톡, 손님 확정 안내)은 예약을 막지 않는다 — 실패는 notifications에 기록
  await notifyReservation(r.id, "created").catch((e) => reportError("web", "notify/created", e));
  return NextResponse.json({ ok: true, id: r.id, code: r.code });
}
