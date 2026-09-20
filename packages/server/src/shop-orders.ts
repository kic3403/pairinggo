/**
 * 전통주 구매 — 주문·배송 (2026-09-21, docs/22 §7, 표 0032).
 * 재고 판정과 주문 줄 만들기는 DB 함수 place_order()가 행을 잠그고 한다(동시 주문에 재고가 음수가 되지 않게).
 * 상태 전이 규칙은 shared canTransition, 여기서는 그 규칙을 지키는 저장만 한다.
 * 결제는 PG 계약 전이라 붙어 있지 않다 — SHOP_TEST_PAY=1 일 때만 시험 주문을 만들 수 있다(pay_provider='test').
 */
import {
  canOrderTransition, cleanAddress, cleanCourier, cleanInvoice, cleanReason, addressProblem, isIslandZip, trackUrl,
  type Address, type Courier, type OrderActor, type OrderStatus,
} from "@pairinggo/shared";
import { db } from "./db";
import { getCart } from "./shop";

type Row = Record<string, unknown>;
const need = () => { const c = db(); if (!c) throw new Error("지금은 주문할 수 없어요"); return c; };
const str = (v: unknown) => (v == null ? "" : String(v));
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0);

/** PG 계약 전에는 실제 결제가 없다. 시험 주문은 환경변수를 켠 동안만 */
export const testPayEnabled = () => process.env.SHOP_TEST_PAY === "1";

export type OrderItemView = {
  id: string; sellerId: string; productId: string | null; drinkId: string;
  name: string; volume: string; price: number; qty: number; cold: boolean;
  status: OrderStatus; cancelReason: string;
};

export type OrderGroupView = {
  sellerId: string; sellerName: string; items: OrderItemView[];
  shipFee: number; courier: Courier; invoice: string; track: string | null;
  shippedAt: string | null; deliveredAt: string | null;
};

export type OrderView = {
  id: string; orderNo: string; status: OrderStatus; createdAt: string;
  itemsTotal: number; shipTotal: number; total: number;
  recv: Address; island: boolean;
  payProvider: string; payMethod: string; paidAt: string | null;
  cancelReason: string;
  groups: OrderGroupView[];
};

const ORDER_COLS =
  "id, order_no, status, created_at, items_total, ship_total, total, island, pay_provider, pay_method, paid_at, cancel_reason, " +
  "recv_name, recv_phone, recv_zip, recv_addr1, recv_addr2, recv_memo, " +
  "order_items(id, seller_id, product_id, drink_id, name, volume, price, qty, cold, status, cancel_reason, sellers(merchant_id, merchants(name))), " +
  "shipments(seller_id, ship_fee, courier_code, courier_name, invoice, shipped_at, delivered_at)";

function orderFromRow(r: Row): OrderView {
  const items = ((r.order_items ?? []) as unknown as Row[]).map((i): OrderItemView & { sellerName: string } => ({
    id: str(i.id), sellerId: str(i.seller_id), productId: i.product_id ? str(i.product_id) : null, drinkId: str(i.drink_id),
    name: str(i.name), volume: str(i.volume), price: int(i.price), qty: int(i.qty), cold: i.cold === true,
    status: (str(i.status) || "paid") as OrderStatus, cancelReason: str(i.cancel_reason),
    sellerName: str(((i.sellers as Row | null)?.merchants as Row | null)?.name),
  }));
  const ships = new Map(((r.shipments ?? []) as unknown as Row[]).map((s) => [str(s.seller_id), s]));
  const groups = new Map<string, OrderGroupView>();
  for (const it of items) {
    let g = groups.get(it.sellerId);
    if (!g) {
      const s = ships.get(it.sellerId);
      const courier = cleanCourier(s?.courier_code, s?.courier_name);
      const invoice = cleanInvoice(s?.invoice);
      g = {
        sellerId: it.sellerId, sellerName: it.sellerName, items: [], shipFee: int(s?.ship_fee),
        courier, invoice, track: trackUrl(courier, invoice),
        shippedAt: s?.shipped_at ? str(s.shipped_at) : null, deliveredAt: s?.delivered_at ? str(s.delivered_at) : null,
      };
      groups.set(it.sellerId, g);
    }
    const { sellerName: _drop, ...view } = it;
    g.items.push(view);
  }
  return {
    id: str(r.id), orderNo: str(r.order_no), status: (str(r.status) || "paid") as OrderStatus, createdAt: str(r.created_at),
    itemsTotal: int(r.items_total), shipTotal: int(r.ship_total), total: int(r.total), island: r.island === true,
    payProvider: str(r.pay_provider), payMethod: str(r.pay_method), paidAt: r.paid_at ? str(r.paid_at) : null,
    cancelReason: str(r.cancel_reason),
    recv: { name: str(r.recv_name), phone: str(r.recv_phone), zip: str(r.recv_zip), addr1: str(r.recv_addr1), addr2: str(r.recv_addr2), memo: str(r.recv_memo) },
    groups: [...groups.values()],
  };
}

/** 주문번호 — YYMMDD + 영숫자 6(헷갈리는 글자 제외) */
function newOrderNo(): string {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString().slice(2, 10).replace(/-/g, "");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 6; i++) tail += chars[Math.floor(Math.random() * chars.length)];
  return d + tail;
}

export type PlaceOrderInput = { address: unknown; consentVersion: string; payProvider?: string; payKey?: string; payMethod?: string };

/**
 * 장바구니 → 주문. 결제가 붙기 전에는 시험 주문(SHOP_TEST_PAY=1)만 만들 수 있다.
 * 재고·판매 상태는 DB 함수가 잠금을 걸고 다시 확인한다 — 여기서 통과해도 거기서 막힐 수 있다.
 */
export async function placeOrder(userId: string, input: PlaceOrderInput): Promise<OrderView> {
  const c = need();
  const addr = cleanAddress(input.address);
  const problem = addressProblem(addr);
  if (problem) throw new Error(problem);
  const island = isIslandZip(addr.zip);
  const cart = await getCart(userId, { island });
  if (!cart.groups.length) throw new Error("장바구니가 비어 있어요");
  if (cart.blocked.length) throw new Error("품절되었거나 살 수 없는 상품이 있어요 — 장바구니를 다시 확인해 주세요");

  const lines = cart.groups.flatMap((g) => g.lines.map((l) => ({ product_id: l.productId, qty: l.qty })));
  const ship = cart.groups.map((g) => ({ seller_id: g.sellerId, ship_fee: g.shipFee }));

  let orderId = "";
  for (let attempt = 0; attempt < 3 && !orderId; attempt++) {
    const { data, error } = await c.rpc("place_order", {
      p_order_no: newOrderNo(), p_user: userId, p_lines: lines, p_ship: ship,
      p_recv: addr, p_island: island, p_consent: input.consentVersion ?? "",
    });
    if (!error) { orderId = String(data); break; }
    if (/duplicate key/i.test(error.message)) continue;          // 주문번호가 겹쳤다 — 다시
    if (/OUT_OF_STOCK:(.*)/.test(error.message)) throw new Error(`${RegExp.$1.trim()} 재고가 모자라요`);
    if (/NOT_SELLING:(.*)/.test(error.message)) throw new Error(`${RegExp.$1.trim()}은(는) 지금 팔지 않아요`);
    if (/OVER_LIMIT:(.*)/.test(error.message)) throw new Error(`${RegExp.$1.trim()}은(는) 한 번에 살 수 있는 수량을 넘었어요`);
    throw new Error(error.message);
  }
  if (!orderId) throw new Error("주문을 만들지 못했어요 — 잠시 뒤 다시 시도해 주세요");

  await c.from("orders").update({
    pay_provider: input.payProvider ?? (testPayEnabled() ? "test" : ""),
    pay_key: input.payKey ?? "", pay_method: input.payMethod ?? (testPayEnabled() ? "시험 결제" : ""),
    paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", orderId);

  const order = await orderById(orderId);
  if (!order) throw new Error("주문을 만들었지만 불러오지 못했어요 — 주문 내역에서 확인해 주세요");
  return order;
}

export async function orderById(id: string): Promise<OrderView | null> {
  const { data } = await need().from("orders").select(ORDER_COLS).eq("id", id).maybeSingle();
  return data ? orderFromRow(data as unknown as Row) : null;
}

export async function myOrders(userId: string, limit = 30): Promise<OrderView[]> {
  const c = db();
  if (!c || !userId) return [];
  const { data, error } = await c.from("orders").select(ORDER_COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) { console.warn("[shop] myOrders", error.message); return []; }
  return ((data ?? []) as unknown as Row[]).map(orderFromRow);
}

export async function myOrderByNo(userId: string, orderNo: string): Promise<OrderView | null> {
  const c = db();
  if (!c || !userId) return null;
  const { data } = await c.from("orders").select(ORDER_COLS).eq("user_id", userId).eq("order_no", String(orderNo).toUpperCase()).maybeSingle();
  return data ? orderFromRow(data as unknown as Row) : null;
}

/** 판매자 화면: 그 양조장 몫 주문만 — order_items를 기준으로 모아 준다 */
export async function sellerOrders(sellerId: string, opts: { status?: OrderStatus | "open"; limit?: number } = {}): Promise<OrderView[]> {
  const c = db();
  if (!c || !sellerId) return [];
  let q = c.from("order_items").select("order_id, status, created_at").eq("seller_id", sellerId).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.status === "open") q = q.in("status", ["paid", "confirmed", "shipped"]);
  else if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) { console.warn("[shop] sellerOrders", error.message); return []; }
  const ids = [...new Set(((data ?? []) as unknown as Row[]).map((r) => str(r.order_id)))];
  if (!ids.length) return [];
  const { data: rows } = await c.from("orders").select(ORDER_COLS).in("id", ids).order("created_at", { ascending: false });
  return ((rows ?? []) as unknown as Row[]).map(orderFromRow).map((o) => ({ ...o, groups: o.groups.filter((g) => g.sellerId === sellerId) }));
}

async function itemsOf(orderId: string, sellerId: string | null) {
  const c = need();
  let q = c.from("order_items").select("id, status, seller_id").eq("order_id", orderId);
  if (sellerId) q = q.eq("seller_id", sellerId);
  const { data } = await q;
  return ((data ?? []) as unknown as Row[]).map((r) => ({ id: str(r.id), status: (str(r.status) || "paid") as OrderStatus, sellerId: str(r.seller_id) }));
}

/** 주문 전체 상태 = 살아 있는 줄 중 가장 뒤처진 상태(모두 취소면 취소) */
async function syncOrderStatus(orderId: string): Promise<OrderStatus> {
  const c = need();
  const items = await itemsOf(orderId, null);
  const live = items.filter((i) => i.status !== "cancelled" && i.status !== "returned");
  const order: OrderStatus[] = ["paid", "confirmed", "shipped", "delivered", "done"];
  let next: OrderStatus = "cancelled";
  if (live.length) next = live.reduce((acc, i) => (order.indexOf(i.status) < order.indexOf(acc) ? i.status : acc), "done" as OrderStatus);
  else if (items.some((i) => i.status === "returned")) next = "returned";
  await c.from("orders").update({ status: next, updated_at: new Date().toISOString() }).eq("id", orderId);
  return next;
}

export type TransitionInput = {
  orderId: string;
  /** 한 양조장 몫만 바꿀 때(판매자). 없으면 주문 전체(손님·운영자) */
  sellerId?: string | null;
  to: OrderStatus;
  actor: OrderActor;
  reason?: string;
  courier?: { code?: unknown; name?: unknown };
  invoice?: unknown;
};

/**
 * 상태 바꾸기 — 규칙(shared canTransition)을 통과한 줄만 바꾼다.
 * 취소는 재고를 되돌려야 해서 DB 함수(cancel_order_items)로 한다.
 */
export async function transitionOrder(t: TransitionInput): Promise<OrderView | null> {
  const c = need();
  const now = Date.now();
  const { data: o } = await c.from("orders").select("id, status").eq("id", t.orderId).maybeSingle();
  if (!o) throw new Error("주문을 찾지 못했어요");

  const { data: shipRows } = await c.from("shipments").select("seller_id, delivered_at").eq("order_id", t.orderId);
  const deliveredAt = new Map(((shipRows ?? []) as unknown as Row[]).map((r) => [str(r.seller_id), r.delivered_at ? new Date(str(r.delivered_at)).getTime() : null]));

  const items = await itemsOf(t.orderId, t.sellerId ?? null);
  const movable = items.filter((i) => canOrderTransition(i.status, t.to, t.actor, { now, deliveredAt: deliveredAt.get(i.sellerId) ?? null }));
  if (!movable.length) throw new Error("지금은 그렇게 바꿀 수 없어요");

  // 발송은 택배사·송장이 있어야 한다 — 상태를 바꾸기 전에 확인한다(예전엔 상태만 바뀌고 송장이 비었다)
  let shipPatch: Row | null = null;
  if (t.sellerId && (t.to === "shipped" || t.to === "delivered")) {
    shipPatch = {};   // shipments에는 updated_at이 없다(0032) — shipped_at·delivered_at으로 때를 남긴다
    if (t.to === "shipped") {
      const courier = cleanCourier(t.courier?.code, t.courier?.name);
      const invoice = cleanInvoice(t.invoice);
      if (!courier.name) throw new Error("택배사를 골라 주세요(목록에 없으면 직접 적어 주세요)");
      if (!invoice) throw new Error("송장번호를 정확히 적어 주세요 — 숫자 8자리 이상");
      shipPatch.courier_code = courier.code; shipPatch.courier_name = courier.name; shipPatch.invoice = invoice; shipPatch.shipped_at = new Date().toISOString();
    } else shipPatch.delivered_at = new Date().toISOString();
  }

  if (t.to === "cancelled") {
    const reason = cleanReason(t.reason);
    if (t.actor === "seller" && !reason) throw new Error("취소 사유를 적어 주세요");
    const { error } = await c.rpc("cancel_order_items", { p_order: t.orderId, p_seller: t.sellerId ?? null, p_reason: reason });
    if (error) throw new Error(error.message);
  } else {
    const patch: Row = { status: t.to, updated_at: new Date().toISOString() };
    if (t.to === "returned") patch.cancel_reason = cleanReason(t.reason);
    const { error } = await c.from("order_items").update(patch).in("id", movable.map((i) => i.id));
    if (error) throw new Error(error.message);
  }

  if (shipPatch) {
    const { error } = await c.from("shipments").update(shipPatch).eq("order_id", t.orderId).eq("seller_id", t.sellerId!);
    if (error) throw new Error(error.message);
  }

  await syncOrderStatus(t.orderId);
  return orderById(t.orderId);
}

/** 운영자 화면: 최근 주문 */
export async function adminOrders(opts: { status?: OrderStatus; limit?: number } = {}): Promise<OrderView[]> {
  const c = need();
  let q = c.from("orders").select(ORDER_COLS).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(orderFromRow);
}

/** 발주 확인·발송이 늦은 주문(어드민 경고) */
export async function lateOrders(hours = 48): Promise<OrderView[]> {
  const c = db();
  if (!c) return [];
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data } = await c.from("order_items").select("order_id").in("status", ["paid", "confirmed"]).lt("created_at", since).limit(50);
  const ids = [...new Set(((data ?? []) as unknown as Row[]).map((r) => str(r.order_id)))];
  if (!ids.length) return [];
  const { data: rows } = await c.from("orders").select(ORDER_COLS).in("id", ids).order("created_at", { ascending: true });
  return ((rows ?? []) as unknown as Row[]).map(orderFromRow);
}
