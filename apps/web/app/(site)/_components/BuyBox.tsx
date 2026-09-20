"use client";
/**
 * 술 화면의 "페어링GO에서 바로 구매"(docs/22) — 입점 양조장이 파는 상품이 있을 때만 뜬다.
 * 술 상세는 10분 캐시(ISR)라 재고·가격은 화면에서 직접 불러온다. 판매자는 양조장이고 우리는 중개자다.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";

type BuyOption = {
  productId: string; name: string; volume: string; abv: number | null;
  price: number; listPrice: number; discount: number; stock: number; buyable: number; cold: boolean; shipFree: boolean; desc: string;
  seller: { id: string; name: string; bizName: string; ownerName: string; bizNo: string; csPhone: string; shipping: string; leadDays: number };
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function BuyBox({ drinkId, drinkName }: { drinkId: string; drinkName: string }) {
  const [options, setOptions] = useState<BuyOption[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const router = useRouter();

  useEffect(() => {
    let live = true;
    fetch(`/api/v1/shop/products?drink=${encodeURIComponent(drinkId)}`)
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((j: { options?: BuyOption[] }) => { if (live) setOptions(j.options ?? []); })
      .catch(() => { if (live) setOptions([]); });
    return () => { live = false; };
  }, [drinkId]);

  if (!options?.length) return null;

  async function add(o: BuyOption, buyNow: boolean) {
    setBusy(o.productId); setMsg(null);
    const r = await fetch("/api/cart", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: o.productId, qty: qty[o.productId] ?? 1 }),
    }).catch(() => null);
    setBusy("");
    if (r?.status === 401) { router.push(`/login?next=${encodeURIComponent(`/drinks/${encodeURIComponent(drinkName)}`)}`); return; }
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!r?.ok) { setMsg({ text: j?.error ?? "담지 못했어요", bad: true }); return; }
    track("cart_add", { d: drinkId, seller: o.seller.id });
    if (buyNow) router.push("/cart");
    else setMsg({ text: "장바구니에 담았어요" });
  }

  return (
    <section className="buy shop">
      <h3>페어링GO에서 바로 구매</h3>
      <ul className="shop-list">
        {options.map((o) => {
          const n = qty[o.productId] ?? 1;
          return (
            <li key={o.productId}>
              <div className="shop-head">
                <div>
                  <b>{o.name}</b>
                  <span className="small muted"> {[o.volume, o.abv != null ? `${o.abv}%` : null].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="shop-price">
                  {o.discount ? <span className="was">{won(o.listPrice)}</span> : null}
                  <b>{won(o.price)}</b>
                </div>
              </div>
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                {o.seller.name} 판매 · {o.seller.shipping} · {o.seller.leadDays === 0 ? "당일 출고" : `보통 ${o.seller.leadDays}일 안에 발송`}
                {o.cold ? " · 냉장 배송" : ""}
                {o.buyable <= 3 ? ` · 남은 수량 ${o.buyable}` : ""}
              </p>
              <div className="shop-buy">
                <select value={n} onChange={(e) => setQty((q) => ({ ...q, [o.productId]: Number(e.target.value) }))} aria-label="수량">
                  {Array.from({ length: Math.max(1, Math.min(o.buyable, 10)) }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v}개</option>)}
                </select>
                <button className="btn" disabled={busy === o.productId} onClick={() => add(o, false)}>장바구니</button>
                <button className="btn p" disabled={busy === o.productId} onClick={() => add(o, true)}>바로 구매</button>
              </div>
            </li>
          );
        })}
      </ul>
      {msg ? <p className={msg.bad ? "small bad" : "small ok"} style={{ marginTop: 8 }}>{msg.text} {!msg.bad ? <Link href="/cart">장바구니 보기</Link> : null}</p> : null}
      <p className="small muted" style={{ marginTop: 8 }}>
        판매자는 <b>{options[0].seller.bizName}</b>({options[0].seller.ownerName}{options[0].seller.bizNo ? ` · 사업자 ${options[0].seller.bizNo}` : ""})이고,
        페어링GO는 통신판매중개자로서 주문을 전달합니다 — 상품·배송·환불 책임은 판매자에게 있습니다. 만 19세 이상만 구매할 수 있습니다.
      </p>
    </section>
  );
}
