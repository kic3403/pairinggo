/** 들어온 주문(docs/22 §7) */
import Link from "next/link";
import { sellerOrders } from "@pairinggo/server/shop-orders";
import { Bar, Tabs } from "../../_bar";
import { requireBrewery } from "@/lib/seller";
import { OrderBoard, type OrderCard } from "../OrderBoard";

export const metadata = { title: "주문" };
export const dynamic = "force-dynamic";

export default async function SellOrdersPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { merchant, seller } = await requireBrewery();
  const all = (await searchParams).all === "1";
  const orders = seller ? await sellerOrders(seller.id, { status: all ? undefined : "open", limit: 100 }) : [];
  const cards: OrderCard[] = orders.flatMap((o) => o.groups.map((g) => ({
    id: o.id, orderNo: o.orderNo, createdAt: o.createdAt, status: o.status, recv: o.recv,
    items: g.items.map((i) => ({ id: i.id, name: i.name, volume: i.volume, price: i.price, qty: i.qty, cold: i.cold, status: i.status })),
    shipFee: g.shipFee, courier: g.courier, invoice: g.invoice, shippedAt: g.shippedAt,
  })));
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <p className="small"><Link href="/sell">← 판매</Link></p>
          <h1>주문 <span className="muted">{cards.length}</span></h1>
          <p className="lead" style={{ margin: 0 }}>영업일 2일 안에 보내 주세요. 손님 번호는 배송을 위해 전달된 정보예요 — 배송 말고 다른 곳에 쓰면 안 돼요.</p>
        </div>
        <div className="row">
          <Link className={`btn sm ${all ? "ghost" : "primary"}`} href="/sell/orders">처리할 주문</Link>
          <Link className={`btn sm ${all ? "primary" : "ghost"}`} href="/sell/orders?all=1">전체</Link>
        </div>
        <OrderBoard initial={cards} defaultCourier={seller?.shipping.courier ?? { code: "", name: "" }} />
      </main>
      <Tabs active="sell" kind={merchant.kind} />
    </>
  );
}
