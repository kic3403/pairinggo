"use client";
/**
 * 파트너 페어링 편집(2026-09-29) — 한 줄씩 바로 저장·삭제.
 *  · 양조장(PairingEditor): 술마다 음식 직접 입력(카탈로그 이름은 추천 목록) + 한 줄 이유
 *  · 식당(RestaurantPairingEditor): 우리 술 표·메뉴에서 고르거나 직접 입력 + 한 줄 이유
 * 저장 뒤 줄마다 "페어링GO ‘해물파전’ 화면에도 연결" 또는 "매장·술 화면과 검색에 보여요"를 알려 준다.
 */
import { useState } from "react";
import { PARTNER_DRINK_TEXT_MAX, PARTNER_FOOD_TEXT_MAX, PARTNER_PAIRING_MAX_PER_DRINK, PARTNER_PAIRING_MAX_TOTAL, PARTNER_PAIRING_NOTE_MAX } from "@pairinggo/shared";

type Named = { id: string; name: string };
export type PairingRow = {
  id: number; drinkId: string | null; drinkText: string; foodId: string | null; foodText: string; note: string; createdAt: string;
  linkedDrink: string | null; linkedFood: string | null; linked: boolean;
};

async function call(method: "POST" | "DELETE", body: unknown) {
  const r = await fetch("/api/pairings", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; row?: PairingRow; error?: string };
  if (!r.ok) throw new Error(j.error || (method === "POST" ? "저장하지 못했어요" : "지우지 못했어요"));
  return j;
}

function LinkNote({ r }: { r: PairingRow }) {
  if (r.linked) return <span className="hint">페어링GO ‘{r.linkedDrink ?? r.drinkText} × {r.linkedFood ?? r.foodText}’ 화면에도 연결됐어요</span>;
  return <span className="hint">매장·술 화면의 추천 칸과 검색에 보여요{r.linkedFood ? ` · 음식은 ‘${r.linkedFood}’로 연결` : ""}</span>;
}

function Line({ r, busy, onRemove, showDrink }: { r: PairingRow; busy: boolean; onRemove: (r: PairingRow) => void; showDrink?: boolean }) {
  return (
    <li className="row-between" style={{ gap: 8, alignItems: "flex-start" }}>
      <span>
        <b>{showDrink ? `${r.drinkText} × ` : ""}{r.foodText}</b>{r.note && <span className="muted"> — {r.note}</span>}
        <br /><LinkNote r={r} />
      </span>
      <button type="button" className="linklike" style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={() => onRemove(r)} aria-label={`${r.foodText} 지우기`}>지우기</button>
    </li>
  );
}

/* ---------- 양조장 ---------- */

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
    if (!name) return;
    setBusy(true); setErr(""); setOk("");
    try {
      const j = await call("POST", { drinkId: drink.id, foodText: name, note });
      if (!j.row) throw new Error("저장하지 못했어요");
      onChange([...rows.filter((x) => x.id !== j.row!.id), j.row]);
      setFood(""); setNote(""); setOk(`${name} 추가했어요 — 페어링GO에 곧 보여요.`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(row: PairingRow) {
    if (!confirm(`${drink.name} × ${row.foodText} 페어링을 지울까요? 손님 화면에서도 빠져요.`)) return;
    setBusy(true); setErr(""); setOk("");
    try { await call("DELETE", { id: row.id }); onChange(rows.filter((x) => x.id !== row.id)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel">
      <div className="row-between">
        <h2 style={{ margin: 0, fontSize: 17 }}>{drink.name} <span className="muted small">{mine.length}/{PARTNER_PAIRING_MAX_PER_DRINK}</span></h2>
        <a className="small" href={`${siteUrl}/drinks/${encodeURIComponent(drink.name.replace(/\s+/g, "-"))}`} target="_blank" rel="noreferrer">손님 화면 ↗</a>
      </div>
      {mine.length > 0 && <ul className="lines" style={{ marginTop: 10 }}>{mine.map((r) => <Line key={r.id} r={r} busy={busy} onRemove={remove} />)}</ul>}
      {!full && (
        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="f" style={{ flex: "1 1 160px" }}><span>어울리는 음식 <span className="hint">(직접 입력, {PARTNER_FOOD_TEXT_MAX}자)</span></span>
            <input type="text" list={`foods-${drink.id}`} value={food} onChange={(e) => setFood(e.target.value)} maxLength={PARTNER_FOOD_TEXT_MAX} placeholder="예: 수제 육포, 도토리묵 무침" autoComplete="off" />
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

/* ---------- 식당 ---------- */

export function RestaurantPairingEditor({ drinks, menu, rows: initial, siteUrl, kakaoId, storeName }: { drinks: string[]; menu: string[]; rows: PairingRow[]; siteUrl: string; kakaoId: string; storeName: string }) {
  const [rows, setRows] = useState<PairingRow[]>(initial);
  const [drink, setDrink] = useState("");
  const [food, setFood] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const full = rows.length >= PARTNER_PAIRING_MAX_TOTAL;

  async function add() {
    if (!drink.trim() || !food.trim()) return;
    setBusy(true); setErr(""); setOk("");
    try {
      const j = await call("POST", { drinkText: drink.trim(), foodText: food.trim(), note });
      if (!j.row) throw new Error("저장하지 못했어요");
      setRows((rs) => [...rs.filter((x) => x.id !== j.row!.id), j.row!]);
      setOk(`${drink.trim()} × ${food.trim()} 추가했어요 — 페어링GO에 곧 보여요.`);
      setFood(""); setNote("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(row: PairingRow) {
    if (!confirm(`${row.drinkText} × ${row.foodText} 추천을 지울까요? 손님 화면에서도 빠져요.`)) return;
    setBusy(true); setErr(""); setOk("");
    try { await call("DELETE", { id: row.id }); setRows((rs) => rs.filter((x) => x.id !== row.id)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <section className="panel">
        <div className="row-between">
          <h2 style={{ margin: 0, fontSize: 17 }}>추천 조합 <span className="muted small">{rows.length}/{PARTNER_PAIRING_MAX_TOTAL}</span></h2>
          <a className="small" href={`${siteUrl}/places/${encodeURIComponent(kakaoId)}?n=${encodeURIComponent(storeName)}`} target="_blank" rel="noreferrer">손님 화면 ↗</a>
        </div>
        {rows.length > 0 ? <ul className="lines" style={{ marginTop: 10 }}>{rows.map((r) => <Line key={r.id} r={r} busy={busy} onRemove={remove} showDrink />)}</ul>
          : <p className="muted small" style={{ margin: "8px 0 0" }}>아직 없어요. 아래에서 첫 조합을 추가해 보세요.</p>}
        {!full && (
          <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="f" style={{ flex: "1 1 170px" }}><span>술 <span className="hint">(우리 술 표에서 고르거나 직접 입력)</span></span>
              <input type="text" list="pp-drinks" value={drink} onChange={(e) => setDrink(e.target.value)} maxLength={PARTNER_DRINK_TEXT_MAX} placeholder="예: 한산소곡주" autoComplete="off" />
              <datalist id="pp-drinks">{drinks.map((d) => <option key={d} value={d} />)}</datalist>
            </label>
            <label className="f" style={{ flex: "1 1 170px" }}><span>어울리는 메뉴 <span className="hint">(메뉴판에서 고르거나 직접 입력)</span></span>
              <input type="text" list="pp-menu" value={food} onChange={(e) => setFood(e.target.value)} maxLength={PARTNER_FOOD_TEXT_MAX} placeholder="예: 해물파전" autoComplete="off" />
              <datalist id="pp-menu">{menu.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label className="f" style={{ flex: "2 1 240px" }}><span>한 줄 이유 <span className="hint">(선택, {PARTNER_PAIRING_NOTE_MAX}자)</span></span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={PARTNER_PAIRING_NOTE_MAX} placeholder="예: 은은한 단맛이 매콤한 양념을 감싸요" />
            </label>
            <button type="button" className="btn primary" disabled={busy || !drink.trim() || !food.trim()} onClick={add}>{busy ? "저장 중…" : "추가"}</button>
          </div>
        )}
        {err && <p className="err" role="alert" style={{ marginTop: 8 }}>{err}</p>}
        {ok && <p className="okmsg" style={{ marginTop: 8 }}>{ok}</p>}
      </section>
      <p className="small muted" style={{ margin: 0 }}>허위·과장 추천이나 우리 가게에서 팔지 않는 조합은 올리지 말아 주세요. 운영자가 지울 수 있어요.</p>
    </>
  );
}
