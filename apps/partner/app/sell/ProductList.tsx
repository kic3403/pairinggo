"use client";
/**
 * 파는 술 목록(docs/22 §5) — 카탈로그 술에 연결해서 가격·재고·용량을 적는다.
 * 카탈로그에 있는 술만 올릴 수 있다(손님 화면의 그 술 페이지에서 바로 팔리게 하려고).
 */
import { useState } from "react";
import { PRODUCT_STATUS_LABEL, discountRate, formatPrice, type Product } from "@pairinggo/shared";

export type DrinkOption = { id: string; name: string; abv: number | null; onlineSellable: boolean };

type Draft = {
  id: string | null; drinkId: string; name: string; volume: string; abv: string;
  price: string; listPrice: string; stock: string; perOrder: string;
  cold: boolean; shipFree: boolean; desc: string; status: Product["status"];
};

const empty = (): Draft => ({ id: null, drinkId: "", name: "", volume: "", abv: "", price: "", listPrice: "", stock: "", perOrder: "", cold: false, shipFree: false, desc: "", status: "selling" });
const toDraft = (p: Product): Draft => ({
  id: p.id, drinkId: p.drinkId, name: p.name, volume: p.volume, abv: p.abv == null ? "" : String(p.abv),
  price: String(p.price), listPrice: p.listPrice ? String(p.listPrice) : "", stock: String(p.stock), perOrder: p.perOrder ? String(p.perOrder) : "",
  cold: p.cold, shipFree: p.shipFree, desc: p.desc, status: p.status,
});

export function ProductList({ initial, drinks, canSell, siteUrl }: { initial: Product[]; drinks: DrinkOption[]; canSell: boolean; siteUrl: string }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<{ busy?: boolean; err?: string; ok?: string }>({});

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function pickDrink(id: string) {
    const d = drinks.find((x) => x.id === id);
    setDraft((p) => (p ? { ...p, drinkId: id, name: p.name || (d?.name ?? ""), abv: p.abv || (d?.abv != null ? String(d.abv) : "") } : p));
  }

  async function save() {
    if (!draft) return;
    setState({ busy: true });
    const r = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draft.id, product: { ...draft } }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string; product?: Product } | undefined;
    if (r?.ok && j?.product) {
      setItems((list) => (draft.id ? list.map((x) => (x.id === j.product!.id ? j.product! : x)) : [j.product!, ...list]));
      setDraft(null);
      setState({ ok: "저장했어요" });
    } else setState({ err: j?.error ?? "저장하지 못했어요" });
  }

  async function remove(id: string) {
    if (!confirm("이 상품을 지울까요? 이미 들어온 주문은 그대로 남아요.")) return;
    const r = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, remove: true }) }).catch(() => null);
    if (r?.ok) setItems((l) => l.filter((x) => x.id !== id));
    else setState({ err: "지우지 못했어요" });
  }

  async function bump(p: Product, delta: number) {
    const r = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, stock: delta }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { product?: Product } | undefined;
    if (j?.product) setItems((l) => l.map((x) => (x.id === j.product!.id ? j.product! : x)));
  }

  return (
    <div className="stack">
      {!canSell ? <p className="small muted" style={{ margin: 0 }}>입점 승인 뒤에 손님 화면에 보여요. 미리 올려 두셔도 됩니다.</p> : null}
      {state.err ? <p className="err">{state.err}</p> : null}
      {state.ok ? <p className="okmsg">{state.ok}</p> : null}

      {draft ? (
        <section className="panel stack">
          <h2 style={{ margin: 0 }}>{draft.id ? "상품 고치기" : "상품 올리기"}</h2>
          <label className="f">어떤 술인가요 <span className="hint">페어링GO에 있는 우리 술을 고르면 그 술 화면에서 팔려요</span>
            <select value={draft.drinkId} onChange={(e) => pickDrink(e.target.value)}>
              <option value="">고르기</option>
              {drinks.map((d) => <option key={d.id} value={d.id} disabled={!d.onlineSellable}>{d.name}{d.onlineSellable ? "" : " (온라인 판매 불가)"}</option>)}
            </select>
          </label>
          <label className="f">상품 이름 <span className="hint">손님에게 보이는 이름 — 용량·구성을 함께 적어 주세요</span>
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={60} placeholder="예: 한산소곡주 500ml" />
          </label>
          <div className="grid2">
            <label className="f">용량<input value={draft.volume} onChange={(e) => set("volume", e.target.value)} maxLength={20} placeholder="500ml" /></label>
            <label className="f">도수(%)<input value={draft.abv} onChange={(e) => set("abv", e.target.value)} inputMode="decimal" maxLength={5} /></label>
          </div>
          <div className="grid2">
            <label className="f">파는 가격<input value={draft.price} onChange={(e) => set("price", e.target.value)} inputMode="numeric" placeholder="25000" /></label>
            <label className="f">정가 <span className="hint">할인 전 가격 · 없으면 비우기</span>
              <input value={draft.listPrice} onChange={(e) => set("listPrice", e.target.value)} inputMode="numeric" />
            </label>
          </div>
          <div className="grid2">
            <label className="f">재고<input value={draft.stock} onChange={(e) => set("stock", e.target.value)} inputMode="numeric" placeholder="10" /></label>
            <label className="f">한 주문 최대 수량 <span className="hint">비우면 제한 없음</span>
              <input value={draft.perOrder} onChange={(e) => set("perOrder", e.target.value)} inputMode="numeric" />
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={draft.cold} onChange={(e) => set("cold", e.target.checked)} /><span>냉장 배송이 필요해요(생막걸리 등)</span></label>
          <label className="check"><input type="checkbox" checked={draft.shipFree} onChange={(e) => set("shipFree", e.target.checked)} /><span>이 상품은 무료배송</span></label>
          <label className="f">설명 <span className="hint">300자</span>
            <textarea value={draft.desc} onChange={(e) => set("desc", e.target.value)} maxLength={300} rows={3} />
          </label>
          <label className="f">판매 상태
            <select value={draft.status} onChange={(e) => set("status", e.target.value as Product["status"])}>
              {(["selling", "soldout", "off"] as const).map((s) => <option key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <div className="row">
            <button className="btn primary" onClick={save} disabled={state.busy}>{state.busy ? "저장 중…" : "저장"}</button>
            <button className="btn ghost" onClick={() => setDraft(null)}>그만두기</button>
          </div>
        </section>
      ) : (
        <button className="btn accent block" onClick={() => { setState({}); setDraft(empty()); }}>+ 상품 올리기</button>
      )}

      {items.length ? (
        <ul className="cards">
          {items.map((p) => (
            <li key={p.id} className="panel stack" style={{ gap: 8 }}>
              <div className="row-between">
                <b>{p.name}</b>
                <span className={`chip ${p.status === "selling" ? (p.stock > 0 ? "ok" : "warn") : "mute"}`}>
                  {p.status === "selling" && p.stock <= 0 ? "품절" : PRODUCT_STATUS_LABEL[p.status]}
                </span>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                {[p.volume, p.abv != null ? `${p.abv}%` : null, formatPrice(p.price), discountRate(p) ? `${discountRate(p)}% 할인` : null, p.cold ? "냉장" : null, p.shipFree ? "무료배송" : null]
                  .filter(Boolean).join(" · ")}
              </p>
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <span className="small">재고 <b className="num">{p.stock}</b></span>
                <button className="btn sm ghost" onClick={() => bump(p, 1)}>+1</button>
                <button className="btn sm ghost" onClick={() => bump(p, 10)}>+10</button>
                <button className="btn sm ghost" onClick={() => bump(p, -1)} disabled={p.stock <= 0}>−1</button>
                <span style={{ marginLeft: "auto" }} />
                <button className="btn sm ghost" onClick={() => { setState({}); setDraft(toDraft(p)); }}>고치기</button>
                <button className="btn sm danger" onClick={() => remove(p.id)}>지우기</button>
              </div>
              {canSell && p.status === "selling" && p.stock > 0 ? (
                <a className="small" href={`${siteUrl}/drinks/${encodeURIComponent(p.name)}`} target="_blank" rel="noreferrer noopener" style={{ display: "none" }}>보기</a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">아직 올린 상품이 없어요.</p>
      )}
    </div>
  );
}
