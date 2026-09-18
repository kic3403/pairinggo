/**
 * 예약 알림 — 웹 푸시(구독한 기기) + 카카오 알림톡(솔라피, 템플릿 심사 뒤). 발송 결과는 notifications에 남긴다.
 * 알림은 예약을 막지 않는다: 예약·상태 변경을 저장한 뒤에 부르고, 실패해도 기록만.
 *   created             → 매장(새 예약) · 손님(예약 확정)
 *   cancelled_by_user   → 매장(손님 취소)
 *   cancelled_by_store  → 손님(매장 취소 + 사유)
 *   reminder            → 손님(당일 아침 리마인드, 크론)
 * 알림톡 템플릿 id는 환경변수(SOLAPI_TPL_*) — 없으면 그 알림톡만 건너뛴다.
 */
import { formatVisit, maskMobile } from "@pairinggo/shared";
import { db } from "./db";
import { sendAlimtalk } from "./sms";
import { reservationById, type Reservation } from "./reservations";
import { pushTo, type PushPayload } from "./push";

export type NotifyEvent = "created" | "cancelled_by_user" | "cancelled_by_store" | "reminder";

const TPL = {
  userConfirmed: () => process.env.SOLAPI_TPL_USER_CONFIRMED || "",
  userCancelled: () => process.env.SOLAPI_TPL_USER_CANCELLED || "",
  userReminder: () => process.env.SOLAPI_TPL_USER_REMINDER || "",
  storeNew: () => process.env.SOLAPI_TPL_STORE_NEW || "",
  storeCancelled: () => process.env.SOLAPI_TPL_STORE_CANCELLED || "",
};
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.vercel.app").replace(/\/$/, "");
const partnerUrl = () => (process.env.PARTNER_SITE_URL || "").replace(/\/$/, "");

type Target = { type: "user" | "partner" | "merchant"; id: string | null };

async function record(channel: "push" | "alimtalk", target: Target, template: string, reservationId: string, status: "sent" | "skipped" | "failed", error = "") {
  await db()?.from("notifications").insert({ channel, target_type: target.type, target_id: target.id, template, reservation_id: reservationId, status, error: error.slice(0, 300) });
}

async function alimtalk(target: Target, to: string, templateId: string, name: string, vars: Record<string, string>, reservationId: string) {
  if (!to) return;
  const r = await sendAlimtalk(to, templateId, vars);
  await record("alimtalk", target, name, reservationId, r.ok ? (r.dev ? "skipped" : "sent") : r.reason === "not_configured" ? "skipped" : "failed", r.ok ? (r.dev ? "개발 환경" : "") : r.reason === "failed" ? r.error ?? "" : "설정 없음");
}

async function push(target: Target, payload: PushPayload, name: string, reservationId: string) {
  if (!target.id || target.type === "merchant") return;
  const r = await pushTo(target.type, target.id, payload);
  if (r.subscriptions === 0) return; // 알림을 켠 기기가 없으면 기록하지 않는다
  await record("push", target, name, reservationId, r.sent > 0 ? "sent" : "failed", r.sent > 0 ? "" : r.error ?? "");
}

/** 매장 소속 파트너들(알림 받을 사람) */
async function merchantPartners(merchantId: string): Promise<{ id: string; phone: string }[]> {
  const { data } = await db()!.from("merchant_members").select("partner_users(id, phone)").eq("merchant_id", merchantId);
  return (data ?? []).flatMap((r) => { const u = r.partner_users as unknown as { id: string; phone: string } | null; return u ? [u] : []; });
}

function vars(r: Reservation) {
  return {
    "#{매장}": r.merchant?.name ?? "", "#{일시}": formatVisit(r.date, r.time), "#{인원}": `${r.partySize}명`, "#{예약번호}": r.code,
    "#{예약자}": r.guestName, "#{연락처}": maskMobile(r.guestPhone), "#{사유}": r.cancelReason || "-", "#{매장번호}": r.merchant?.phone || "-",
  };
}

export async function notifyReservation(reservationId: string, event: NotifyEvent): Promise<void> {
  if (!db()) return;
  const r = await reservationById(reservationId);
  if (!r) return;
  const v = vars(r);
  const when = formatVisit(r.date, r.time);
  const userTarget: Target = { type: "user", id: r.userId };
  const myUrl = `${siteUrl()}/my/reservations`;

  if (event === "created" || event === "cancelled_by_user") {
    const created = event === "created";
    const partners = await merchantPartners(r.merchantId);
    const payload: PushPayload = {
      title: created ? `새 예약 · ${when}` : `예약 취소 · ${when}`,
      body: `${r.guestName} · ${r.partySize}명${created && r.note ? ` · ${r.note.slice(0, 40)}` : ""}`,
      url: partnerUrl() ? `${partnerUrl()}/?date=${r.date}` : "/", tag: `res-${r.id}`,
    };
    for (const p of partners) {
      const t: Target = { type: "partner", id: p.id };
      await push(t, payload, created ? "store_new" : "store_cancelled", r.id);
      await alimtalk(t, p.phone, created ? TPL.storeNew() : TPL.storeCancelled(), created ? "store_new" : "store_cancelled", v, r.id);
    }
  }
  if (event === "created") {
    await push(userTarget, { title: "예약이 확정됐어요", body: `${r.merchant?.name ?? ""} · ${when} · ${r.partySize}명`, url: myUrl, tag: `res-${r.id}` }, "user_confirmed", r.id);
    await alimtalk(userTarget, r.guestPhone, TPL.userConfirmed(), "user_confirmed", v, r.id);
  }
  if (event === "cancelled_by_store") {
    await push(userTarget, { title: "매장에서 예약을 취소했어요", body: `${r.merchant?.name ?? ""} · ${when}${r.cancelReason ? ` · ${r.cancelReason}` : ""}`, url: myUrl, tag: `res-${r.id}` }, "user_cancelled", r.id);
    await alimtalk(userTarget, r.guestPhone, TPL.userCancelled(), "user_cancelled", v, r.id);
  }
  if (event === "reminder") {
    await push(userTarget, { title: "오늘 예약이 있어요", body: `${r.merchant?.name ?? ""} · ${when} · ${r.partySize}명`, url: myUrl, tag: `res-${r.id}` }, "user_reminder", r.id);
    await alimtalk(userTarget, r.guestPhone, TPL.userReminder(), "user_reminder", v, r.id);
  }
}
