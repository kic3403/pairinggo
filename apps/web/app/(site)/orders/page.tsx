/** 내 주문 — 로그인 필요(docs/22) */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ORDER_STATUS_LABEL } from "@pairinggo/shared";
import { auth } from "@/auth";
import { myOrders } from "@/lib/shop";

export const metadata: Metadata = { title: "내 주문 | 페어링GO", robots: { index: false } };
export const dynamic = "force-dynamic";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const dateText = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`; };

export default async function OrdersPage() {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login?next=/orders");
  const orders = await myOrders(uid);
  return (
    <div className="wrap">
      <h1>내 주문</h1>
      {!orders.length ? (
        <div className="box" style={{ textAlign: "center", padding: "28px 16px" }}>
          <p className="muted">아직 주문이 없어요.</p>
          <div className="btns" style={{ justifyContent: "center" }}><Link className="btn p" href="/drinks">전통주 보러 가기</Link></div>
        </div>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.orderNo}`}>
                <div className="ol-head">
                  <b className="num">{o.orderNo}</b>
                  <span className={`badge ${o.status === "cancelled" ? "" : "o"}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                </div>
                <p className="small muted">
                  {dateText(o.createdAt)} · {o.groups.flatMap((g) => g.items)[0]?.name}
                  {o.groups.flatMap((g) => g.items).length > 1 ? ` 외 ${o.groups.flatMap((g) => g.items).length - 1}건` : ""} · {won(o.total)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
