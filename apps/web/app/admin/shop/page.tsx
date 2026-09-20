/**
 * 어드민 — 구매(중개, docs/22): 입점 양조장 심사와 들어온 주문.
 * 입점 승인은 **주류 통신판매 승인 번호를 확인한 뒤**에만(전통주 제조자만 통신판매할 수 있다).
 */
import Link from "next/link";
import { listSellers } from "@pairinggo/server/shop";
import { adminOrders, lateOrders, testPayEnabled } from "@pairinggo/server/shop-orders";
import { ORDER_STATUS_LABEL, formatBizNo, kstParts, shippingLabel } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import SellerActions from "./SellerActions";

export const dynamic = "force-dynamic";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const dateText = (iso: string) => {
  const k = kstParts(new Date(iso));
  return `${k.date.slice(5).replace("-", ".")} ${String(Math.floor(k.minutes / 60)).padStart(2, "0")}:${String(k.minutes % 60).padStart(2, "0")}`;
};
const STATUS: Record<string, { label: string; tone: string }> = {
  applied: { label: "승인 대기", tone: "w" }, approved: { label: "판매중", tone: "o" }, suspended: { label: "정지", tone: "" },
};

export default async function AdminShopPage() {
  await requireAdmin();
  const [sellers, orders, late] = await Promise.all([listSellers(), adminOrders({ limit: 50 }), lateOrders()]);
  const waiting = sellers.filter((s) => s.status === "applied").length;

  return (
    <>
      <h1>구매 <span className="muted">입점 {sellers.length} · 주문 {orders.length}</span></h1>
      <p className="muted small">
        판매자는 입점 양조장입니다 — 페어링GO는 통신판매중개자로서 주문만 전달합니다(주류를 사거나 팔지 않습니다).
        {testPayEnabled() ? " 지금은 시험 결제가 켜져 있어요(SHOP_TEST_PAY=1)." : " 결제(PG)가 아직 붙지 않아 손님은 주문할 수 없습니다."}
      </p>

      {late.length ? (
        <p className="note bad">발송이 늦은 주문 {late.length}건 — {late.slice(0, 5).map((o) => o.orderNo).join(", ")}</p>
      ) : null}

      <h2>입점 양조장 {waiting ? <span className="badge w">승인 대기 {waiting}</span> : null}</h2>
      {!sellers.length ? <p className="muted">아직 입점 신청이 없어요.</p> : (
        <ul className="cards">
          {sellers.map((s) => (
            <li key={s.id} className="card">
              <div className="row-between">
                <b>{s.name}</b>
                <span className={`badge ${STATUS[s.status]?.tone ?? ""}`}>{STATUS[s.status]?.label ?? s.status}</span>
              </div>
              <p className="small muted">
                {s.bizName || "상호 미입력"}{s.bizNo ? ` · ${formatBizNo(s.bizNo)}` : ""}{s.ownerName ? ` · ${s.ownerName}` : ""}
                {s.csPhone ? ` · ${s.csPhone}` : ""}
              </p>
              <p className="small">
                통신판매 승인 <b>{s.licenseNo || "없음 — 승인 불가"}</b>{s.licenseAt ? ` (${s.licenseAt})` : ""}
                {s.licenseNote ? ` · ${s.licenseNote}` : ""}
              </p>
              <p className="small muted">
                {shippingLabel(s.shipping)} · {s.shipping.courier.name || "택배사 미정"} · 출고 {s.shipping.leadDays}일
                {s.shipping.cold ? " · 냉장 가능" : ""} · 수수료 {s.feeRate}%
              </p>
              {s.fromAddr ? <p className="small muted">출고지 {s.fromAddr}</p> : null}
              <SellerActions id={s.id} status={s.status} feeRate={s.feeRate} hasLicense={!!s.licenseNo} />
            </li>
          ))}
        </ul>
      )}

      <h2>최근 주문</h2>
      {!orders.length ? <p className="muted">아직 주문이 없어요.</p> : (
        <table className="tbl">
          <thead><tr><th>주문번호</th><th>때</th><th>판매자</th><th>상품</th><th>금액</th><th>상태</th></tr></thead>
          <tbody>
            {orders.map((o) => {
              const items = o.groups.flatMap((g) => g.items);
              return (
                <tr key={o.id}>
                  <td className="num">{o.orderNo}</td>
                  <td className="small">{dateText(o.createdAt)}</td>
                  <td className="small">{o.groups.map((g) => g.sellerName).join(", ")}</td>
                  <td className="small">{items[0]?.name}{items.length > 1 ? ` 외 ${items.length - 1}` : ""}</td>
                  <td className="num">{won(o.total)}</td>
                  <td><span className={`badge ${o.status === "cancelled" ? "" : "o"}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="small muted" style={{ marginTop: 16 }}>
        설계·법 구조는 <Link href="/admin">대시보드</Link> 옆 docs/22 문서에 있습니다. 수수료는 시범 3개월 0% → 5%.
      </p>
    </>
  );
}
