"use client";
/**
 * 주문 처리(docs/22 §7) — 발주 확인 → 발송(택배사·송장) → 배송 완료. 발송 전에는 사유를 적고 취소할 수 있다.
 * 택배사는 배송 설정의 기본값이 미리 들어가고, 그 주문만 다른 곳으로 보냈으면 바꿀 수 있다.
 */
import { useState } from "react";
import { COURIERS, COURIER_ETC, ORDER_STATUS_LABEL, formatPrice, type Courier, type OrderStatus } from "@pairinggo/shared";

export type OrderCard = {
  id: string; orderNo: string; createdAt: string; status: OrderStatus;
  recv: { name: string; phone: string; zip: string; addr1: string; addr2: string; memo: string };
  items: { id: string; name: string; volume: string; price: number; qty: number; cold: boolean; status: OrderStatus }[];
  shipFee: number; courier: Courier; invoice: string; shippedAt: string | null;
};

const dateText = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const phoneText = (p: string) => (p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p);

export function OrderBoard({ initial, defaultCourier }: { initial: OrderCard[]; defaultCourier: Courier }) {
  const [orders, setOrders] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [ship, setShip] = useState<{ code: string; name: string; invoice: string }>({ code: defaultCourier.code, name: defaultCourier.name, invoice: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function move(o: OrderCard, to: OrderStatus, extra: Record<string, unknown> = {}) {
    setBusy(o.id); setErr("");
    const r = await fetch("/api/sell-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: o.id, to, ...extra }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string; order?: OrderCard } | undefined;
    setBusy("");
    if (!r?.ok) { setErr(j?.error ?? "바꾸지 못했어요"); return; }
    if (j?.order) setOrders((l) => l.map((x) => (x.id === o.id ? j.order! : x)));
    setOpen(null);
  }

  async function cancel(o: OrderCard) {
    const reason = prompt("취소 사유를 적어 주세요(손님에게 그대로 보여요)");
    if (!reason?.trim()) return;
    await move(o, "cancelled", { reason });
  }

  if (!orders.length) return <p className="small muted">아직 들어온 주문이 없어요.</p>;

  return (
    <div className="stack">
      {err ? <p className="err">{err}</p> : null}
      {orders.map((o) => {
        const live = o.items.filter((i) => i.status !== "cancelled");
        const st = live[0]?.status ?? o.items[0]?.status ?? o.status;
        const total = live.reduce((s, i) => s + i.price * i.qty, 0) + o.shipFee;
        return (
          <section key={o.id} className="panel stack" style={{ gap: 10 }}>
            <div className="row-between">
              <b className="num">{o.orderNo}</b>
              <span className={`chip ${st === "cancelled" ? "mute" : st === "paid" ? "warn" : "ok"}`}>{ORDER_STATUS_LABEL[st]}</span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{dateText(o.createdAt)} 주문</p>

            <ul className="lines">
              {o.items.map((i) => (
                <li key={i.id}>
                  <span>{i.name}{i.volume ? ` · ${i.volume}` : ""}{i.cold ? " · 냉장" : ""}</span>
                  <span className="num">{i.qty}개 · {formatPrice(i.price * i.qty)}</span>
                  {i.status === "cancelled" ? <span className="chip mute">취소</span> : null}
                </li>
              ))}
            </ul>
            <p className="small" style={{ margin: 0 }}>배송비 {formatPrice(o.shipFee)} · 합계 <b>{formatPrice(total)}</b></p>

            <div className="addr small">
              <b>{o.recv.name}</b> · <a href={`tel:${o.recv.phone}`}>{phoneText(o.recv.phone)}</a>
              <div className="muted">({o.recv.zip}) {o.recv.addr1} {o.recv.addr2}</div>
              {o.recv.memo ? <div className="muted">요청: {o.recv.memo}</div> : null}
            </div>

            {o.invoice ? (
              <p className="small" style={{ margin: 0 }}>{o.courier.name} · 송장 <span className="num">{o.invoice}</span></p>
            ) : null}

            {st === "paid" || st === "confirmed" ? (
              open === o.id ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="grid2">
                    <label className="f">택배사
                      <select
                        value={COURIERS.some((c) => c.code === ship.code) ? ship.code : ship.name ? COURIER_ETC : ""}
                        onChange={(e) => setShip((s) => (e.target.value === COURIER_ETC ? { ...s, code: COURIER_ETC, name: "" } : { ...s, code: e.target.value, name: COURIERS.find((c) => c.code === e.target.value)?.name ?? "" }))}
                      >
                        <option value="">고르기</option>
                        {COURIERS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                        <option value={COURIER_ETC}>목록에 없어요 — 직접 적기</option>
                      </select>
                    </label>
                    {ship.code === COURIER_ETC ? (
                      <label className="f">택배사 이름<input value={ship.name} onChange={(e) => setShip((s) => ({ ...s, name: e.target.value }))} maxLength={20} /></label>
                    ) : null}
                  </div>
                  <label className="f">송장번호
                    <input value={ship.invoice} onChange={(e) => setShip((s) => ({ ...s, invoice: e.target.value }))} inputMode="numeric" placeholder="숫자만" maxLength={30} />
                  </label>
                  <div className="row">
                    <button className="btn primary" disabled={busy === o.id} onClick={() => move(o, "shipped", { courier: { code: ship.code, name: ship.name }, invoice: ship.invoice })}>발송 처리</button>
                    <button className="btn ghost" onClick={() => setOpen(null)}>그만두기</button>
                  </div>
                </div>
              ) : (
                <div className="row">
                  {st === "paid" ? <button className="btn ghost" disabled={busy === o.id} onClick={() => move(o, "confirmed")}>발주 확인</button> : null}
                  <button className="btn primary" onClick={() => { setErr(""); setOpen(o.id); }}>발송·송장 입력</button>
                  <button className="btn danger" disabled={busy === o.id} onClick={() => cancel(o)}>취소</button>
                </div>
              )
            ) : st === "shipped" ? (
              <div className="row">
                <button className="btn ghost" disabled={busy === o.id} onClick={() => move(o, "delivered")}>배송 완료로 바꾸기</button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
