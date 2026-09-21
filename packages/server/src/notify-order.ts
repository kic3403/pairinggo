/**
 * 주문 알림(2026-09-21, docs/22 §9) — 웹 푸시(알림 켠 기기) + 카카오 알림톡(솔라피). 결과는 notifications(0034 order_id).
 * 예약 알림과 같은 원칙: **주문을 막지 않는다** — 저장이 끝난 뒤에 부르고, 실패해도 기록만 남긴다.
 *   paid               → 손님(주문 완료) · 판매자(새 주문)
 *   shipped            → 손님(발송 + 택배사·송장)
 *   delivered          → 손님(배송 완료 + 반품 기한 안내)
 *   cancelled_by_user  → 판매자(손님이 취소했으니 보내지 마세요)
 *   cancelled_by_seller→ 손님(판매자 취소 + 사유)
 *   late               → 판매자(아직 안 보낸 주문, 아침 크론 — 하루 한 번)
 * 알림톡 템플릿 id는 환경변수(SOLAPI_TPL_ORDER_*) — 없으면 그 알림톡만 건너뛴다(푸시는 그대로).
 */
import { RETURN_DAYS, formatPrice, maskMobile } from "@pairinggo/shared";
import { db } from "./db";
import { sendAlimtalk } from "./sms";
import { pushTo, type PushPayload } from "./push";
import { orderById, type OrderGroupView, type OrderView } from "./shop-orders";

export type OrderNotifyEvent = "paid" | "shipped" | "delivered" | "cancelled_by_user" | "cancelled_by_seller" | "late";

const TPL = {
  orderPaid: () => process.env.SOLAPI_TPL_ORDER_PAID || "",
  orderShipped: () => process.env.SOLAPI_TPL_ORDER_SHIPPED || "",
  orderDelivered: () => process.env.SOLAPI_TPL_ORDER_DELIVERED || "",
  orderCancelled: () => process.env.SOLAPI_TPL_ORDER_CANCELLED || "",
  sellerNew: () => process.env.SOLAPI_TPL_SELLER_NEW || "",
  sellerCancelled: () => process.env.SOLAPI_TPL_SELLER_CANCELLED || "",
  sellerLate: () => process.env.SOLAPI_TPL_SELLER_LATE || "",
};
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://pairinggo.vercel.app").replace(/\/$/, "");
const partnerUrl = () => (process.env.PARTNER_SITE_URL || "").replace(/\/$/, "");

type Target = { type: "user" | "partner"; id: string | null };

async function record(channel: "push" | "alimtalk", target: Target, template: string, orderId: string, status: "sent" | "skipped" | "failed", error = "") {
  await db()?.from("notifications").insert({
    channel, target_type: target.type, target_id: target.id, template, order_id: orderId, status, error: error.slice(0, 300),
  });
}

async function alimtalk(target: Target, to: string, templateId: string, name: string, vars: Record<string, string>, orderId: string) {
  if (!to) return;
  const r = await sendAlimtalk(to, templateId, vars);
  await record("alimtalk", target, name, orderId,
    r.ok ? (r.dev ? "skipped" : "sent") : r.reason === "not_configured" ? "skipped" : "failed",
    r.ok ? (r.dev ? "개발 환경" : "") : r.reason === "failed" ? r.error ?? "" : "설정 없음");
}

async function push(target: Target, payload: PushPayload, name: string, orderId: string) {
  if (!target.id) return;
  const r = await pushTo(target.type, target.id, payload);
  if (r.subscriptions === 0) return;   // 알림을 켠 기기가 없으면 기록하지 않는다
  await record("push", target, name, orderId, r.sent > 0 ? "sent" : "failed", r.sent > 0 ? "" : r.error ?? "");
}

/** 그 판매자(양조장) 매장에 속한 파트너들 — 알림을 받을 사람 */
async function sellerPartners(sellerId: string): Promise<{ id: string; phone: string }[]> {
  const c = db();
  if (!c || !sellerId) return [];
  const { data: s } = await c.from("sellers").select("merchant_id").eq("id", sellerId).maybeSingle();
  const merchantId = (s as { merchant_id?: string } | null)?.merchant_id;
  if (!merchantId) return [];
  const { data } = await c.from("merchant_members").select("partner_users(id, phone)").eq("merchant_id", merchantId);
  return (data ?? []).flatMap((r) => {
    const u = r.partner_users as unknown as { id: string; phone: string } | null;
    return u ? [u] : [];
  });
}

/** 한 줄 요약 — "감싸주는 날 약주 500ml 외 2건" */
const itemsText = (g: OrderGroupView) => {
  const live = g.items.filter((i) => i.status !== "cancelled");
  const first = live[0]?.name ?? g.items[0]?.name ?? "";
  return live.length > 1 ? `${first} 외 ${live.length - 1}건` : first;
};
const firstText = (o: OrderView) => (o.groups[0] ? itemsText(o.groups[0]) : "");
const groupTotal = (g: OrderGroupView) =>
  g.items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.price * i.qty, 0) + g.shipFee;

function vars(o: OrderView, g?: OrderGroupView) {
  return {
    "#{주문번호}": o.orderNo,
    "#{상품}": g ? itemsText(g) : firstText(o),
    "#{금액}": formatPrice(g ? groupTotal(g) : o.total),
    "#{판매자}": g?.sellerName ?? o.groups[0]?.sellerName ?? "",
    "#{받는분}": o.recv.name,
    "#{연락처}": maskMobile(o.recv.phone),
    "#{택배사}": g?.courier.name || "-",
    "#{송장번호}": g?.invoice || "-",
    "#{사유}": o.cancelReason || g?.items.find((i) => i.cancelReason)?.cancelReason || "-",
  };
}

/**
 * 주문 알림 보내기. sellerId를 주면 그 판매자 몫만(발송·판매자 취소는 판매자별로 일어난다).
 * 실패해도 던지지 않는다 — 부르는 쪽에서 주문 처리가 끊기면 안 된다.
 */
export async function notifyOrder(orderId: string, event: OrderNotifyEvent, sellerId?: string | null): Promise<void> {
  if (!db()) return;
  const o = await orderById(orderId).catch(() => null);
  if (!o) return;
  const groups = sellerId ? o.groups.filter((g) => g.sellerId === sellerId) : o.groups;
  const userTarget: Target = { type: "user", id: null };   // 주문의 회원 id는 아래에서 채운다
  const { data: row } = await db()!.from("orders").select("user_id").eq("id", orderId).maybeSingle();
  userTarget.id = (row as { user_id?: string | null } | null)?.user_id ?? null;
  const myUrl = `${siteUrl()}/orders/${o.orderNo}`;

  // ── 판매자에게
  if (event === "paid" || event === "cancelled_by_user" || event === "late") {
    for (const g of groups) {
      const partners = await sellerPartners(g.sellerId);
      const title = event === "paid" ? `새 주문 · ${itemsText(g)}`
        : event === "late" ? `아직 안 보낸 주문이 있어요`
        : `주문 취소 · ${itemsText(g)}`;
      const body = event === "late"
        ? `주문 ${o.orderNo} — 손님이 기다리고 있어요. 발송하고 송장을 넣어 주세요.`
        : `${formatPrice(groupTotal(g))} · ${o.recv.name}${event === "paid" ? " · 발송하고 송장을 넣어 주세요" : " · 보내지 마세요"}`;
      const payload: PushPayload = { title, body, url: partnerUrl() ? `${partnerUrl()}/sell/orders` : "/", tag: `order-${o.id}` };
      const tpl = event === "paid" ? TPL.sellerNew() : event === "late" ? TPL.sellerLate() : TPL.sellerCancelled();
      const name = event === "paid" ? "seller_new" : event === "late" ? "seller_late" : "seller_cancelled";
      for (const p of partners) {
        const t: Target = { type: "partner", id: p.id };
        await push(t, payload, name, o.id);
        await alimtalk(t, p.phone, tpl, name, vars(o, g), o.id);
      }
    }
  }

  // ── 손님에게
  if (event === "paid") {
    const what = o.groups.length > 1 ? `${firstText(o)} 외 ${o.groups.length - 1}곳` : firstText(o);
    await push(userTarget, { title: "주문이 들어갔어요", body: `${what} · ${formatPrice(o.total)}`, url: myUrl, tag: `order-${o.id}` }, "order_paid", o.id);
    await alimtalk(userTarget, o.recv.phone, TPL.orderPaid(), "order_paid", vars(o), o.id);
  }
  if (event === "shipped") {
    for (const g of groups) {
      await push(userTarget, {
        title: "주문하신 술이 출발했어요",
        body: `${g.sellerName} · ${itemsText(g)}${g.invoice ? ` · ${g.courier.name} ${g.invoice}` : ""}`,
        url: myUrl, tag: `order-${o.id}`,
      }, "order_shipped", o.id);
      await alimtalk(userTarget, o.recv.phone, TPL.orderShipped(), "order_shipped", vars(o, g), o.id);
    }
  }
  if (event === "delivered") {
    for (const g of groups) {
      await push(userTarget, {
        title: "배송이 끝났어요",
        body: `${itemsText(g)} · 문제가 있으면 ${RETURN_DAYS}일 안에 알려 주세요`,
        url: myUrl, tag: `order-${o.id}`,
      }, "order_delivered", o.id);
      await alimtalk(userTarget, o.recv.phone, TPL.orderDelivered(), "order_delivered", vars(o, g), o.id);
    }
  }
  if (event === "cancelled_by_seller") {
    for (const g of groups) {
      const reason = g.items.find((i) => i.cancelReason)?.cancelReason || o.cancelReason;
      await push(userTarget, {
        title: "판매자가 주문을 취소했어요",
        body: `${g.sellerName} · ${itemsText(g)}${reason ? ` · ${reason}` : ""} — 결제하신 금액은 돌려드려요`,
        url: myUrl, tag: `order-${o.id}`,
      }, "order_cancelled", o.id);
      await alimtalk(userTarget, o.recv.phone, TPL.orderCancelled(), "order_cancelled", vars(o, g), o.id);
    }
  }
}

/**
 * 아직 안 보낸 주문을 판매자에게 알린다(아침 크론) — 출고 기한(기본 영업일 2일)을 넘긴 줄만, 하루 한 번.
 * 보낸 줄에는 late_notified_at을 찍어 같은 주문으로 매일 독촉하지 않는다.
 */
export async function notifyLateOrders(hours = 48, now = Date.now()): Promise<number> {
  const c = db();
  if (!c) return 0;
  const since = new Date(now - hours * 3600_000).toISOString();
  const onceADay = new Date(now - 20 * 3600_000).toISOString();
  const { data } = await c.from("order_items")
    .select("id, order_id, seller_id, late_notified_at")
    .in("status", ["paid", "confirmed"]).lt("created_at", since).limit(100);
  const rows = ((data ?? []) as { id: string; order_id: string; seller_id: string; late_notified_at: string | null }[])
    .filter((r) => !r.late_notified_at || r.late_notified_at < onceADay);
  const pairs = new Map<string, { orderId: string; sellerId: string; ids: string[] }>();
  for (const r of rows) {
    const key = `${r.order_id}|${r.seller_id}`;
    const cur = pairs.get(key) ?? { orderId: String(r.order_id), sellerId: String(r.seller_id), ids: [] };
    cur.ids.push(String(r.id));
    pairs.set(key, cur);
  }
  let sent = 0;
  for (const p of pairs.values()) {
    await notifyOrder(p.orderId, "late", p.sellerId).catch(() => null);
    await c.from("order_items").update({ late_notified_at: new Date(now).toISOString() }).in("id", p.ids);
    sent++;
  }
  return sent;
}
