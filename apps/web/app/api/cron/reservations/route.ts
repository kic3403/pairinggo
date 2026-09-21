import { addDays, kstParts } from "@pairinggo/shared";
import { notifyReservation, notifyStoreToday } from "@pairinggo/server/notify";
import { notifyLateOrders } from "@pairinggo/server/notify-order";
import { reportError } from "@pairinggo/server/errors";
import { cleanupMenuPhotos } from "@pairinggo/server/menu-photo";
import { cleanupReviewPhotos } from "@/lib/reviews";
import { db } from "@/lib/db";
import { error, json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/reservations — 매일 아침(08:00 KST 무렵, Vercel Hobby 크론은 한 시간 안에서 흔들림).
 *  1. 손님 당일 안내(확정 예약) 2. 매장 "오늘 예약 N팀" 3. **아직 안 보낸 주문 독촉**(판매자, docs/22 §9) 4. 방문일 1년 지난 예약 삭제 5. 하루 지난 인증번호 기록 삭제 — 개인정보처리방침 3번 6. 표에서 빠진 지 30일 된 메뉴 사진 삭제
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(req, 401, "권한 없음");
  const sb = db();
  if (!sb) return json(req, { ok: false, reason: "DB 미설정" }, { status: 202, headers: NO_CACHE });
  const today = kstParts(new Date()).date;

  const { data: rows, error: e1 } = await sb.from("reservations").select("id, merchant_id, party_size, merchants(name)").eq("visit_date", today).eq("status", "confirmed");
  if (e1) return error(req, 500, e1.message);
  let reminded = 0;
  const byMerchant = new Map<string, { name: string; parties: number; people: number }>();
  for (const r of rows ?? []) {
    await notifyReservation(String(r.id), "reminder").then(() => reminded++).catch((e) => reportError("web", "cron/reminder", e));
    const m = byMerchant.get(String(r.merchant_id)) ?? { name: String((r.merchants as unknown as { name?: string } | null)?.name ?? ""), parties: 0, people: 0 };
    m.parties++; m.people += Number(r.party_size);
    byMerchant.set(String(r.merchant_id), m);
  }
  for (const [id, m] of byMerchant) await notifyStoreToday(id, m.name, m.parties, m.people).catch((e) => reportError("web", "cron/store-today", e));

  // 아직 안 보낸 주문을 판매자에게 알린다(하루 한 번, docs/22 §9)
  const lateOrders = await notifyLateOrders().catch((e) => { reportError("web", "cron/late-orders", e); return 0; });

  const { count: purgedReservations } = await sb.from("reservations").delete({ count: "exact" }).lt("visit_date", addDays(today, -365));
  const { count: purgedOtp } = await sb.from("phone_verifications").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - 86400_000).toISOString());
  await sb.from("password_resets").delete().lt("created_at", new Date(Date.now() - 86400_000).toISOString());
  // 운영 오류 기록 — 해결한 것은 30일, 나머지는 마지막으로 난 지 90일 지나면 지운다
  await sb.from("server_errors").delete().not("resolved_at", "is", null).lt("last_at", new Date(Date.now() - 30 * 86400_000).toISOString());
  await sb.from("server_errors").delete().lt("last_at", new Date(Date.now() - 90 * 86400_000).toISOString());
  // 표에서 빠진 메뉴 사진 — 30일(변경 이력 되돌리기 기간) 지나면 지운다
  const purgedMenuPhotos = await cleanupMenuPhotos().catch((e) => { void reportError("web", "cron/menu-photos", e); return 0; });
  // 리뷰에 붙지 않은 채 하루 지난 리뷰 사진(쓰다 만 것)
  const purgedReviewPhotos = await cleanupReviewPhotos().catch((e) => { void reportError("web", "cron/review-photos", e); return 0; });
  // 영수증 읽기 기록 — 하루 횟수 제한용이라 7일이면 충분
  await sb.from("receipt_reads").delete().lt("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
  const { count: purgedNotifications } = await sb.from("notifications").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - 180 * 86400_000).toISOString());
  return json(req, { ok: true, today, reminded, merchants: byMerchant.size, lateOrders, purgedReservations: purgedReservations ?? 0, purgedOtp: purgedOtp ?? 0, purgedNotifications: purgedNotifications ?? 0, purgedMenuPhotos, purgedReviewPhotos }, { headers: NO_CACHE });
}
