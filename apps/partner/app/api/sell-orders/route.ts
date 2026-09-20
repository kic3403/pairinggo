import { transitionOrder } from "@pairinggo/server/shop-orders";
import type { OrderStatus } from "@pairinggo/shared";
import { sellerOrError } from "@/lib/seller";

/** 주문 상태 바꾸기(판매자) — 그 양조장 몫만 */
export async function POST(req: Request) {
  const a = await sellerOrError({ approved: true }); if (a instanceof Response) return a;
  try {
    const b = (await req.json()) as { orderId: string; to: OrderStatus; reason?: string; courier?: { code?: string; name?: string }; invoice?: string };
    const order = await transitionOrder({
      orderId: b.orderId, sellerId: a.seller!.id, to: b.to, actor: "seller",
      reason: b.reason, courier: b.courier, invoice: b.invoice,
    });
    const g = order?.groups.find((x) => x.sellerId === a.seller!.id);
    return Response.json({
      ok: true,
      order: order && g ? {
        id: order.id, orderNo: order.orderNo, createdAt: order.createdAt, status: order.status, recv: order.recv,
        items: g.items, shipFee: g.shipFee, courier: g.courier, invoice: g.invoice, shippedAt: g.shippedAt,
      } : null,
    });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
