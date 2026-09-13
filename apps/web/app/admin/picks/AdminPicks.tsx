"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Opt = { id: string; name: string };
export type Item = { id: number; status: string; note: string; image: string | null; nick: string; at: string; reviewNote: string | null; drinkId: string | null; foodId: string | null; drinkText: string; foodText: string };

export default function AdminPicks({ items, drinks, foods }: { items: Item[]; drinks: Opt[]; foods: Opt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<Record<number, string>>({});
  const [sel, setSel] = useState<Record<number, { d: string; f: string }>>({});
  const get = (it: Item) => sel[it.id] ?? { d: it.drinkId ?? "", f: it.foodId ?? "" };

  const act = async (it: Item, action: "publish" | "hide") => {
    const s = get(it);
    if (action === "publish" && (!s.d || !s.f)) { setMsg((m) => ({ ...m, [it.id]: "술과 음식을 모두 골라 주세요" })); return; }
    setBusy(it.id);
    try {
      const r = await fetch("/admin/api/picks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: it.id, action, drinkId: s.d, foodId: s.f, note: action === "hide" ? "운영자 숨김" : "검수 지정" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "실패");
      setMsg((m) => ({ ...m, [it.id]: action === "hide" ? "숨겼습니다" : `게시했습니다 (같은 조합 ${j.n}명)` }));
      router.refresh();
    } catch (e) { setMsg((m) => ({ ...m, [it.id]: (e as Error).message })); }
    finally { setBusy(null); }
  };

  if (!items.length) return <div className="card muted">검수할 회원 추천이 없습니다.</div>;
  return (
    <>
      <datalist id="adm-drinks">{drinks.map((d) => <option key={d.id} value={d.name} />)}</datalist>
      <datalist id="adm-foods">{foods.map((f) => <option key={f.id} value={f.name} />)}</datalist>
      {items.map((it) => {
        const s = get(it);
        const setD = (name: string) => setSel((x) => ({ ...x, [it.id]: { d: drinks.find((o) => o.name === name)?.id ?? "", f: s.f } }));
        const setF = (name: string) => setSel((x) => ({ ...x, [it.id]: { d: s.d, f: foods.find((o) => o.name === name)?.id ?? "" } }));
        return (
          <div key={it.id} className="card">
            <div><span className="chip">{it.status === "review" ? "검수 대기" : "숨김"}</span> <b>{it.drinkText || "?"}</b> × <b>{it.foodText || "?"}</b> <span className="muted">· {it.nick} · {it.at}</span></div>
            {it.note && <p style={{ margin: "6px 0" }}>“{it.note}”</p>}
            {it.image && <a href={it.image} target="_blank" rel="noopener noreferrer"><img src={it.image} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} /></a>}
            {it.reviewNote && <p className="muted" style={{ margin: "4px 0" }}>메모: {it.reviewNote}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <input list="adm-drinks" placeholder="술 (카탈로그 이름)" defaultValue={drinks.find((o) => o.id === s.d)?.name ?? ""} onChange={(e) => setD(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <input list="adm-foods" placeholder="음식 (카탈로그 이름)" defaultValue={foods.find((o) => o.id === s.f)?.name ?? ""} onChange={(e) => setF(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <button className="btn p sm" disabled={busy === it.id} onClick={() => act(it, "publish")}>게시</button>
              {it.status !== "hidden" && <button className="btn d sm" disabled={busy === it.id} onClick={() => act(it, "hide")}>숨김</button>}
            </div>
            {msg[it.id] && <p className="muted" style={{ margin: "6px 0 0" }}>{msg[it.id]}</p>}
          </div>
        );
      })}
    </>
  );
}
