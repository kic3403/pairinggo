import { addDays, kstParts } from "@pairinggo/shared";
import { notifyReservation, notifyStoreToday } from "@pairinggo/server/notify";
import { db } from "@/lib/db";
import { error, json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/reservations — 매일 아침(08:00 KST 무렵, Vercel Hobby 크론은 한 시간 안에서 흔들림).
 *  1. 손님 당일 안내(확정 예약) 2. 매장 "오늘 예약 N팀" 3. 방문일 1년 지난 예약 삭제 4. 하루 지난 인증번호 기록 삭제 — 개인정보처리방침 3번
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
    await notifyReservation(String(r.id), "reminder").then(() => reminded++).catch((e) => console.error("[cron reminder]", (e as Error).message));
    const m = byMerchant.get(String(r.merchant_id)) ?? { name: String((r.merchants as unknown as { name?: string } | null)?.name ?? ""), parties: 0, people: 0 };
    m.parties++; m.people += Number(r.party_size);
    byMerchant.set(String(r.merchant_id), m);
  }
  for (const [id, m] of byMerchant) await notifyStoreToday(id, m.name, m.parties, m.people).catch((e) => console.error("[cron store]", (e as Error).message));

  const { count: purgedReservations } = await sb.from("reservations").delete({ count: "exact" }).lt("visit_date", addDays(today, -365));
  const { count: purgedOtp } = await sb.from("phone_verifications").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - 86400_000).toISOString());
  const { count: purgedNotifications } = await sb.from("notifications").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - 180 * 86400_000).toISOString());
  return json(req, { ok: true, today, reminded, merchants: byMerchant.size, purgedReservations: purgedReservations ?? 0, purgedOtp: purgedOtp ?? 0, purgedNotifications: purgedNotifications ?? 0 }, { headers: NO_CACHE });
}
