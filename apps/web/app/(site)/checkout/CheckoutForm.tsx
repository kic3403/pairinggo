"use client";
/**
 * 주문서(docs/22 §5) — 받는 분·배송지·요청사항 + 판매자에게 정보를 전달하는 동의.
 * 결제(PG)는 계약 전이라 아직 붙어 있지 않다. 그때까지 "결제 준비 중"으로 막고, 시험 주문만 열어 둔다.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addressProblem, cleanAddress, isIslandZip, type CartSummary } from "@pairinggo/shared";
import { track } from "@/lib/track";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function CheckoutForm({ cart, payReady, me }: { cart: CartSummary; payReady: boolean; me: { name: string; phone: string } }) {
  const [a, setA] = useState({ name: me.name, phone: me.phone, zip: "", addr1: "", addr2: "", memo: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  const set = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) => setA({ ...a, [k]: e.target.value });

  // 도서산간이면 추가 배송비가 붙는다 — 주소를 적는 동안 미리 알려 준다
  const island = isIslandZip(a.zip);

  async function submit() {
    const problem = addressProblem(cleanAddress(a));
    if (problem) { setErr(problem); return; }
    if (!agree) { setErr("판매자에게 주문 정보를 전달하는 데 동의해 주세요"); return; }
    setBusy(true); setErr("");
    track("order_submit", { sellers: cart.groups.length, total: cart.total });
    const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: a, agree }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { orderNo?: string; error?: string } | undefined;
    setBusy(false);
    if (!r?.ok || !j?.orderNo) { setErr(j?.error ?? "주문하지 못했어요"); return; }
    track("order_done", { orderNo: j.orderNo });
    router.push(`/orders/${j.orderNo}`);
  }

  return (
    <div className="checkout">
      <section className="box">
        <h3>받는 분</h3>
        <div className="fields">
          <label>이름<input value={a.name} onChange={set("name")} maxLength={20} autoComplete="name" /></label>
          <label>휴대폰<input value={a.phone} onChange={set("phone")} inputMode="tel" maxLength={20} autoComplete="tel" placeholder="010-0000-0000" /></label>
          <label>우편번호<input value={a.zip} onChange={set("zip")} inputMode="numeric" maxLength={5} autoComplete="postal-code" placeholder="5자리" /></label>
          <label>주소<input value={a.addr1} onChange={set("addr1")} maxLength={120} autoComplete="street-address" /></label>
          <label>상세 주소<input value={a.addr2} onChange={set("addr2")} maxLength={60} /></label>
          <label>배송 요청사항<input value={a.memo} onChange={set("memo")} maxLength={100} placeholder="부재 시 문 앞 등" /></label>
        </div>
        {island ? <p className="small muted" style={{ marginTop: 8 }}>제주·도서산간이라 양조장이 정한 추가 배송비가 붙어요.</p> : null}
      </section>

      <section className="box">
        <h3>주문 상품</h3>
        {cart.groups.map((g) => (
          <div key={g.sellerId} className="co-seller">
            <b className="small">{g.name}</b>
            <ul className="cart-lines">
              {g.lines.map((l) => (
                <li key={l.productId}>
                  <div className="cl-main"><b>{l.name}</b><span className="small muted">{l.qty}개</span></div>
                  <div className="cl-side"><b className="num">{won(l.price * l.qty)}</b></div>
                </li>
              ))}
            </ul>
            <p className="small muted" style={{ margin: "4px 0 0" }}>배송비 {g.shipFee === 0 ? "무료" : won(g.shipFee)}</p>
          </div>
        ))}
        <p className="co-sum"><span>결제 예정 금액</span><b className="num">{won(cart.total)}</b></p>
      </section>

      <section className="box">
        <h3>동의</h3>
        <label className="agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            주문 정보(받는 분 이름·휴대폰·주소·요청사항)를 <b>판매자(양조장)</b>에게 전달하는 데 동의합니다 — 배송과 문의에만 쓰입니다.
            자세한 내용은 <Link href="/privacy">개인정보처리방침</Link>에 있어요.
          </span>
        </label>
        <p className="small muted" style={{ marginTop: 10 }}>
          페어링GO는 통신판매중개자로서 거래 당사자가 아니며, 상품·배송·환불 책임은 판매자에게 있습니다. 주류는 만 19세 이상만 구매할 수 있고, 받는 분 확인이 필요할 수 있습니다.
        </p>
      </section>

      {err ? <p className="small bad">{err}</p> : null}
      {payReady ? (
        <button className="btn p block" onClick={submit} disabled={busy}>{busy ? "주문 중…" : `${won(cart.total)} 주문하기`}</button>
      ) : (
        <div className="box" style={{ textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>결제 준비 중이에요 — 결제 계약이 끝나면 바로 열립니다.</p>
        </div>
      )}
    </div>
  );
}
