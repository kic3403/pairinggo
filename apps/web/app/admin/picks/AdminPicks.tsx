"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Opt = { id: string; name: string };
export type Item = { id: number; status: string; note: string; image: string | null; nick: string; at: string; reviewNote: string | null; drinkId: string | null; foodId: string | null; drinkText: string; foodText: string };

export default function AdminPicks({ items, drinks, foods }: { items: Item[]; drinks: Opt[]; foods: Opt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<Record<number, string>>({});
  // 술·음식은 이름을 직접 적는다(2026-09-29) — 카탈로그 이름은 추천 목록으로만, 없는 이름도 그대로 게시
  const [sel, setSel] = useState<Record<number, { d: string; f: string }>>({});
  const nameOf = (list: Opt[], id: string | null) => (id ? list.find((o) => o.id === id)?.name ?? "" : "");
  const get = (it: Item) => sel[it.id] ?? { d: nameOf(drinks, it.drinkId) || it.drinkText || "", f: nameOf(foods, it.foodId) || it.foodText || "" };
  const inCat = (list: Opt[], name: string) => list.some((o) => o.name === name.trim());

  const act = async (it: Item, action: "publish" | "hide") => {
    const s = get(it);
    if (action === "publish" && (!s.d.trim() || !s.f.trim())) { setMsg((m) => ({ ...m, [it.id]: "술과 음식 이름을 모두 적어 주세요" })); return; }
    setBusy(it.id);
    try {
      const r = await fetch("/admin/api/picks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: it.id, action, drinkText: s.d, foodText: s.f, note: action === "hide" ? "운영자 숨김" : "검수 게시" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "실패");
      setMsg((m) => ({ ...m, [it.id]: action === "hide" ? "숨겼습니다" : j.linkedDrink && j.linkedFood ? `게시했습니다 — 카탈로그 ‘${j.linkedDrink} × ${j.linkedFood}’로 집계(같은 조합 ${j.n}명)` : `게시했습니다 — 적은 이름 그대로(카탈로그에 없는 ${[!j.linkedDrink && "술", !j.linkedFood && "음식"].filter(Boolean).join("·")}은 '없는 술' 목록에도 올라가요)` }));
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
        const setD = (name: string) => setSel((x) => ({ ...x, [it.id]: { d: name, f: s.f } }));
        const setF = (name: string) => setSel((x) => ({ ...x, [it.id]: { d: s.d, f: name } }));
        return (
          <div key={it.id} className="card">
            <div><span className="chip">{it.status === "review" ? "검수 대기" : "숨김"}</span> <b>{it.drinkText || "?"}</b> × <b>{it.foodText || "?"}</b> <span className="muted">· {it.nick} · {it.at}</span></div>
            {it.note && <p style={{ margin: "6px 0" }}>“{it.note}”</p>}
            {it.image && <a href={it.image} target="_blank" rel="noopener noreferrer"><img src={it.image} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} /></a>}
            {it.reviewNote && <p className="muted" style={{ margin: "4px 0" }}>메모: {it.reviewNote}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "flex-end" }}>
              <label style={{ flex: 1, minWidth: 160, margin: 0 }}>술 {s.d.trim() && <span className={`tag${inCat(drinks, s.d) ? " g" : " m"}`}>{inCat(drinks, s.d) ? "카탈로그" : "직접 입력"}</span>}
                <input list="adm-drinks" placeholder="술 이름 (직접 입력 가능)" value={s.d} onChange={(e) => setD(e.target.value)} />
              </label>
              <label style={{ flex: 1, minWidth: 160, margin: 0 }}>음식 {s.f.trim() && <span className={`tag${inCat(foods, s.f) ? " g" : " m"}`}>{inCat(foods, s.f) ? "카탈로그" : "직접 입력"}</span>}
                <input list="adm-foods" placeholder="음식 이름 (직접 입력 가능)" value={s.f} onChange={(e) => setF(e.target.value)} />
              </label>
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
