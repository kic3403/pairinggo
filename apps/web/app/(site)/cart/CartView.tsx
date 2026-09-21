"use client";
/** 장바구니(docs/22 §5) — 양조장별로 묶고 배송비를 따로 보여 준다(결제 직전에 배송비가 뛰지 않게) */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { freeShipHint, type CartSummary } from "@pairinggo/shared";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function CartView({ initial }: { initial: CartSummary }) {
  const [cart, setCart] = useState(initial);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function change(productId: string, qty: number) {
    setBusy(productId); setErr("");
    const r = await fetch("/api/cart", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, qty, set: true }),
    }).catch(() => null);
    setBusy("");
    const j = (await r?.json().catch(() => ({}))) as { cart?: CartSummary; error?: string } | undefined;
    if (!r?.ok) { setErr(j?.error ?? "바꾸지 못했어요"); return; }
    if (j?.cart) setCart(j.cart);
  }

  if (!cart.groups.length) {
    return (
      <div className="box" style={{ textAlign: "center", padding: "28px 16px" }}>
        <p className="muted">장바구니가 비어 있어요.</p>
        <div className="btns" style={{ justifyContent: "center" }}><Link className="btn p" href="/drinks">전통주 보러 가기</Link></div>
      </div>
    );
  }

  return (
    <div>
      {err ? <p className="small bad">{err}</p> : null}
      {cart.blocked.length ? (
        <p className="small bad">품절되었거나 살 수 없는 상품이 있어요 — 수량을 줄이거나 빼 주세요.</p>
      ) : null}

      {cart.groups.map((g) => (
        <section key={g.sellerId} className="box cart-seller">
          <h3>{g.name}</h3>
          <ul className="cart-lines">
            {g.lines.map((l) => (
              <li key={l.productId}>
                {l.photo ? <img className="cl-img" src={l.photo} alt="" /> : null}
                <div className="cl-main">
                  <b>{l.name}</b>
                  <span className="small muted">{[l.volume, l.cold ? "냉장" : null].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="cl-side">
                  <select value={l.qty} onChange={(e) => change(l.productId, Number(e.target.value))} disabled={busy === l.productId} aria-label="수량">
                    {Array.from({ length: Math.max(1, Math.min(l.buyable ?? 10, 10)) }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v}개</option>)}
                  </select>
                  <b className="num">{won(l.price * l.qty)}</b>
                  <button className="linkbtn" onClick={() => change(l.productId, 0)} disabled={busy === l.productId}>빼기</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            상품 {won(g.itemsTotal)} · 배송비 {g.shipFee === 0 ? "무료" : won(g.shipFee)}
            {freeShipHint(g) ? ` · ${freeShipHint(g)}` : ""}
          </p>
        </section>
      ))}

      <div className="box cart-total">
        <p><span>상품 금액</span><b className="num">{won(cart.itemsTotal)}</b></p>
        <p><span>배송비</span><b className="num">{cart.shipTotal === 0 ? "무료" : won(cart.shipTotal)}</b></p>
        <p className="sum"><span>결제 예정 금액</span><b className="num">{won(cart.total)}</b></p>
        <button className="btn p block" disabled={!!cart.blocked.length} onClick={() => router.push("/checkout")}>주문하기</button>
        <p className="small muted" style={{ marginTop: 8 }}>배송비는 양조장마다 따로 붙어요. 만 19세 이상만 구매할 수 있습니다.</p>
      </div>
    </div>
  );
}
