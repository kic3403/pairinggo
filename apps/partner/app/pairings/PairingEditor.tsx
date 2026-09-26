"use client";
/** 술마다 음식 고르기(카탈로그 datalist) + 한 줄 이유 → 추가. 줄마다 삭제. 저장은 한 줄씩 바로. */
import { useState } from "react";
import { PARTNER_PAIRING_MAX_PER_DRINK, PARTNER_PAIRING_NOTE_MAX } from "@pairinggo/shared";

type Named = { id: string; name: string };
export type PairingRow = { id: number; drinkId: string; drinkName: string; foodId: string; foodName: string; note: string; createdAt: string };

function DrinkBlock({ drink, foods, rows, siteUrl, onChange }: { drink: Named; foods: Named[]; rows: PairingRow[]; siteUrl: string; onChange: (rows: PairingRow[]) => void }) {
  const [food, setFood] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const mine = rows.filter((r) => r.drinkId === drink.id);
  const full = mine.length >= PARTNER_PAIRING_MAX_PER_DRINK;

  async function add() {
    const name = food.trim();
    const f = foods.find((x) => x.name === name) ?? foods.find((x) => x.name.replace(/\s/g, "") === name.replace(/\s/g, ""));
    if (!f) { setErr("목록에 있는 음식 이름을 골라 주세요. 없는 음식은 운영자에게 알려 주세요."); return; }
    if (mine.some((r) => r.foodId === f.id)) { setErr("이미 적은 음식이에요."); return; }
    setBusy(true); setErr(""); setOk("");
    try {
      const r = await fetch("/api/pairings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drinkId: drink.id, foodId: f.id, note }) });
      const j = (await r.json()) as { ok?: boolean; row?: PairingRow; error?: string };
      if (!r.ok || !j.row) throw new Error(j.error || "저장하지 못했어요");
      onChange([...rows.filter((x) => x.id !== j.row!.id), j.row]);
      setFood(""); setNote(""); setOk(`${f.name} 추가했어요 — 페어링GO에 곧 보여요.`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(row: PairingRow) {
    if (!confirm(`${row.drinkName} × ${row.foodName} 페어링을 지울까요? 손님 화면에서도 빠져요.`)) return;
    setBusy(true); setErr(""); setOk("");
    try {
      const r = await fetch("/api/pairings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(j.error || "지우지 못했어요");
      onChange(rows.filter((x) => x.id !== row.id));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel">
      <div className="row-between">
        <h2 style={{ margin: 0, fontSize: 17 }}>{drink.name} <span className="muted small">{mine.length}/{PARTNER_PAIRING_MAX_PER_DRINK}</span></h2>
        <a className="small" href={`${siteUrl}/drinks/${encodeURIComponent(drink.name)}`} target="_blank" rel="noreferrer">손님 화면 ↗</a>
      </div>
      {mine.length > 0 && (
        <ul className="lines" style={{ marginTop: 10 }}>
          {mine.map((r) => (
            <li key={r.id} className="row-between" style={{ gap: 8 }}>
              <span><b>{r.foodName}</b>{r.note && <span className="muted"> — {r.note}</span>}</span>
              <button type="button" className="linklike" style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={() => remove(r)} aria-label={`${r.foodName} 지우기`}>지우기</button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="f" style={{ flex: "1 1 160px" }}>어울리는 음식
            <input type="text" list={`foods-${drink.id}`} value={food} onChange={(e) => setFood(e.target.value)} placeholder="예: 해물파전" autoComplete="off" />
            <datalist id={`foods-${drink.id}`}>{foods.map((f) => <option key={f.id} value={f.name} />)}</datalist>
          </label>
          <label className="f" style={{ flex: "2 1 220px" }}><span>한 줄 이유 <span className="hint">(선택, {PARTNER_PAIRING_NOTE_MAX}자)</span></span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={PARTNER_PAIRING_NOTE_MAX} placeholder="예: 기름진 전의 맛을 산미가 씻어 줘요" />
          </label>
          <button type="button" className="btn primary" disabled={busy || !food.trim()} onClick={add}>{busy ? "저장 중…" : "추가"}</button>
        </div>
      )}
      {err && <p className="err" role="alert" style={{ marginTop: 8 }}>{err}</p>}
      {ok && <p className="okmsg" style={{ marginTop: 8 }}>{ok}</p>}
    </section>
  );
}

export function PairingEditor({ drinks, foods, rows: initial, siteUrl }: { drinks: Named[]; foods: Named[]; rows: PairingRow[]; siteUrl: string }) {
  const [rows, setRows] = useState<PairingRow[]>(initial);
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>적은 페어링 {rows.length}개 · 술 {drinks.length}종</p>
      {drinks.map((d) => <DrinkBlock key={d.id} drink={d} foods={foods} rows={rows} siteUrl={siteUrl} onChange={setRows} />)}
    </>
  );
}
