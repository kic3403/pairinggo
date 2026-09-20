/** 주문 상세 — 배송 조회·취소(docs/22 §7). 로그인한 본인 주문만 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ORDER_STATUS_LABEL, cancelable } from "@pairinggo/shared";
import { auth } from "@/auth";
import { myOrderByNo } from "@/lib/shop";
import ExtLink from "../../_components/ExtLink";
import CancelOrder from "./CancelOrder";

export const metadata: Metadata = { title: "주문 상세 | 페어링GO", robots: { index: false } };
export const dynamic = "force-dynamic";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const dateText = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export default async function OrderDetailPage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const uid = (await auth())?.user?.id;
  if (!uid) redirect(`/login?next=/orders/${no}`);
  const o = await myOrderByNo(uid, no);
  if (!o) notFound();

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/orders">내 주문</Link> · {o.orderNo}</p>
      <h1>주문 {o.orderNo}</h1>
      <p className="small muted">{dateText(o.createdAt)} 주문 · {ORDER_STATUS_LABEL[o.status]}{o.payMethod ? ` · ${o.payMethod}` : ""}</p>
      {o.cancelReason ? <p className="small bad">취소 사유: {o.cancelReason}</p> : null}

      {o.groups.map((g) => (
        <section key={g.sellerId} className="box">
          <h3>{g.sellerName}</h3>
          <ul className="cart-lines">
            {g.items.map((i) => (
              <li key={i.id}>
                <div className="cl-main">
                  <b>{i.name}</b>
                  <span className="small muted">{[i.volume, i.cold ? "냉장" : null, `${i.qty}개`].filter(Boolean).join(" · ")}</span>
                  {i.status !== o.status ? <span className="small muted"> · {ORDER_STATUS_LABEL[i.status]}</span> : null}
                </div>
                <div className="cl-side"><b className="num">{won(i.price * i.qty)}</b></div>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: "6px 0 0" }}>배송비 {g.shipFee === 0 ? "무료" : won(g.shipFee)}</p>
          {g.invoice ? (
            <p className="small" style={{ margin: "6px 0 0" }}>
              {g.courier.name} · 송장 <span className="num">{g.invoice}</span>
              {g.track ? <> · <ExtLink className="linkish" href={g.track} event="external_link" props={{ kind: "track" }}>배송 조회 ↗</ExtLink></> : " (조회는 택배사 홈페이지에서)"}
            </p>
          ) : null}
        </section>
      ))}

      <section className="box">
        <h3>받는 분</h3>
        <p className="small">{o.recv.name} · {o.recv.phone}</p>
        <p className="small muted">({o.recv.zip}) {o.recv.addr1} {o.recv.addr2}</p>
        {o.recv.memo ? <p className="small muted">요청: {o.recv.memo}</p> : null}
      </section>

      <section className="box">
        <p className="co-sum"><span>상품 금액</span><b className="num">{won(o.itemsTotal)}</b></p>
        <p className="co-sum"><span>배송비</span><b className="num">{o.shipTotal === 0 ? "무료" : won(o.shipTotal)}</b></p>
        <p className="co-sum total"><span>결제 금액</span><b className="num">{won(o.total)}</b></p>
      </section>

      {cancelable(o.status) ? <CancelOrder orderNo={o.orderNo} /> : null}

      <p className="small muted" style={{ marginTop: 14 }}>
        상품·배송·환불 문의는 판매자에게 해 주세요. 페어링GO는 통신판매중개자로서 거래 당사자가 아닙니다.
        단순 변심 반품은 배송 완료 뒤 7일 안에 신청할 수 있고 왕복 배송비가 듭니다(파손·오배송은 판매자 부담).
      </p>
    </div>
  );
}
