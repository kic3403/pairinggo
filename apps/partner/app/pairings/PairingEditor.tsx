"use client";
/**
 * 파트너 페어링 편집(2026-09-29) — 한 줄씩 바로 저장·삭제.
 *  · 양조장(PairingEditor): 술마다 **추천 조합 체크**(2026-10-03 — 카탈로그의 근거·맛 분석 상위 조합, 체크하고 추가하면 "○○ 제공" 근거로 확정)
 *    + 음식 직접 입력(카탈로그 이름은 추천 목록) + 한 줄 이유
 *  · 식당(RestaurantPairingEditor): 우리 술 표 × 메뉴의 추천 조합 체크 + 고르거나 직접 입력 + 한 줄 이유
 * 추천은 참고일 뿐 자동으로 넣지 않는다. 체크든 직접 입력이든 근거 등급은 같다(official, "○○ 제공/추천"). 이유는 추정 문장을 기본으로 넣고 고칠 수 있다.
 * 저장 뒤 줄마다 "페어링GO ‘해물파전’ 화면에도 연결" 또는 "매장·술 화면과 검색에 보여요"를 알려 준다.
 */
import { useMemo, useState } from "react";
import { PARTNER_DRINK_TEXT_MAX, PARTNER_FOOD_TEXT_MAX, PARTNER_PAIRING_MAX_PER_DRINK, PARTNER_PAIRING_MAX_TOTAL, PARTNER_PAIRING_NOTE_MAX } from "@pairinggo/shared";

type Named = { id: string; name: string };
export type PairingRow = {
  id: number; drinkId: string | null; drinkText: string; foodId: string | null; foodText: string; note: string; createdAt: string;
  linkedDrink: string | null; linkedFood: string | null; linked: boolean;
};
/** 추천 조합 한 줄(서버 suggestPartnerPairings) — 양조장은 drinkId·foodId, 식당은 술 표 이름·메뉴 이름(foodText) */
export type Suggestion = { drinkId: string; drinkText: string; foodId: string; food: string; foodText: string; src: string; label: string; note: string; hint: string };

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

/**
 * 추천 조합 체크 목록 — 체크하면 이유를 고칠 수 있는 칸이 열리고, "체크한 N개 추가"로 한 번에 저장(하나씩 순서대로, 실패한 것은 남긴다).
 * keyOf = 줄의 고유 키(양조장은 foodId, 식당은 drink|food), save = 한 줄 저장(POST 본문은 호출한 쪽이 정한다)
 */
function SuggestList({ items, max, busy, setBusy, keyOf, showDrink, save, who }: {
  items: Suggestion[]; max: number; busy: boolean; setBusy: (b: boolean) => void; keyOf: (s: Suggestion) => string; showDrink?: boolean;
  save: (s: Suggestion, note: string) => Promise<void>; who: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  if (!items.length) return null;
  const n = [...checked].filter((k) => items.some((s) => keyOf(s) === k)).length;
  const toggle = (k: string) => setChecked((c) => { const next = new Set(c); if (next.has(k)) next.delete(k); else if (next.size < max) next.add(k); return next; });
  async function addChecked() {
    setBusy(true); setErr(""); setOk("");
    const picked = items.filter((s) => checked.has(keyOf(s)));
    let done = 0; const fails: string[] = [];
    for (const s of picked) {
      try { await save(s, notes[keyOf(s)] ?? s.note); done++; setChecked((c) => { const next = new Set(c); next.delete(keyOf(s)); return next; }); }
      catch (e) { fails.push(`${showDrink ? `${s.drinkText} × ` : ""}${s.foodText}: ${(e as Error).message}`); }
    }
    setBusy(false);
    if (done) setOk(`${done}개 추가했어요 — 페어링GO에 “${who}”로 곧 보여요.`);
    if (fails.length) setErr(fails.join(" / "));
  }
  return (
    <div className="sugg">
      <p className="small muted" style={{ margin: "0 0 6px" }}>추천 조합 — 체크하고 추가하면 <b>“{who}”</b> 추천으로 올라가요. 이유는 고쳐도 돼요. 체크하지 않은 조합은 올라가지 않아요.</p>
      <ul className="lines sugg-list">
        {items.map((s) => {
          const k = keyOf(s), on = checked.has(k);
          return (
            <li key={k}>
              <label className="chk">
                <input type="checkbox" checked={on} disabled={busy || (!on && checked.size >= max)} onChange={() => toggle(k)} />
                <span><b>{showDrink ? `${s.drinkText} × ` : ""}{s.foodText}</b> <span className="hint">{s.label}</span>{!on && s.hint && <span className="hint"> · {s.hint}</span>}</span>
              </label>
              {on && <input type="text" className="sugg-note" value={notes[k] ?? s.note} maxLength={PARTNER_PAIRING_NOTE_MAX} placeholder={s.note ? "한 줄 이유(선택)" : `한 줄 이유(선택) — 참고: ${s.hint}`.slice(0, 80)} onChange={(e) => setNotes((m) => ({ ...m, [k]: e.target.value }))} aria-label={`${s.foodText} 이유`} />}
            </li>
          );
        })}
      </ul>
      <div className="row" style={{ gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={busy || n === 0} onClick={addChecked}>{busy ? "저장 중…" : `체크한 ${n}개 추가`}</button>
        <span className="hint">한 번에 {max}개까지</span>
      </div>
      {err && <p className="err" role="alert" style={{ marginTop: 8 }}>{err}</p>}
      {ok && <p className="okmsg" style={{ marginTop: 8 }}>{ok}</p>}
    </div>
  );
}

/* ---------- 양조장 ---------- */

function DrinkBlock({ drink, foods, rows, suggestions, siteUrl, who, onChange }: { drink: Named; foods: Named[]; rows: PairingRow[]; suggestions: Suggestion[]; siteUrl: string; who: string; onChange: (f: (rows: PairingRow[]) => PairingRow[]) => void }) {
  const [food, setFood] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const mine = rows.filter((r) => r.drinkId === drink.id);
  const full = mine.length >= PARTNER_PAIRING_MAX_PER_DRINK;
  const taken = new Set(mine.map((r) => r.foodId).filter(Boolean) as string[]);
  const sugg = useMemo(() => suggestions.filter((s) => !taken.has(s.foodId)), [suggestions, mine.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function saveOne(foodText: string, noteText: string) {
    const j = await call("POST", { drinkId: drink.id, foodText, note: noteText });
    if (!j.row) throw new Error("저장하지 못했어요");
    onChange((rs) => [...rs.filter((x) => x.id !== j.row!.id), j.row!]);
  }
  async function add() {
    const name = food.trim();
    if (!name) return;
    setBusy(true); setErr(""); setOk("");
    try { await saveOne(name, note); setFood(""); setNote(""); setOk(`${name} 추가했어요 — 페어링GO에 곧 보여요.`); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(row: PairingRow) {
    if (!confirm(`${drink.name} × ${row.foodText} 페어링을 지울까요? 손님 화면에서도 빠져요.`)) return;
    setBusy(true); setErr(""); setOk("");
    try { await call("DELETE", { id: row.id }); onChange((rs) => rs.filter((x) => x.id !== row.id)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel">
      <div className="row-between">
        <h2 style={{ margin: 0, fontSize: 17 }}>{drink.name} <span className="muted small">{mine.length}/{PARTNER_PAIRING_MAX_PER_DRINK}</span></h2>
        <a className="small" href={`${siteUrl}/drinks/${encodeURIComponent(drink.name.replace(/\s+/g, "-"))}`} target="_blank" rel="noreferrer">손님 화면 ↗</a>
      </div>
      {!full && <SuggestList items={sugg} max={PARTNER_PAIRING_MAX_PER_DRINK - mine.length} busy={busy} setBusy={setBusy} keyOf={(s) => s.foodId} who={who} save={(s, n) => saveOne(s.foodText, n)} />}
      {!full && (
        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="f" style={{ flex: "1 1 160px" }}><span>직접 입력 <span className="hint">(추천에 없는 음식, {PARTNER_FOOD_TEXT_MAX}자)</span></span>
            <input type="text" list={`foods-${drink.id}`} value={food} onChange={(e) => setFood(e.target.value)} maxLength={PARTNER_FOOD_TEXT_MAX} placeholder="예: 수제 육포, 도토리묵 무침" autoComplete="off" />
            <datalist id={`foods-${drink.id}`}>{foods.map((f) => <option key={f.id} value={f.name} />)}</datalist>
          </label>
          <label className="f" style={{ flex: "2 1 220px" }}><span>한 줄 이유 <span className="hint">(선택, {PARTNER_PAIRING_NOTE_MAX}자)</span></span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={PARTNER_PAIRING_NOTE_MAX} placeholder="예: 기름진 전의 맛을 산미가 씻어 줘요" />
          </label>
          <button type="button" className="btn primary" disabled={busy || !food.trim()} onClick={add}>{busy ? "저장 중…" : "추가"}</button>
        </div>
      )}
      {mine.length > 0 && (
        <>
          <p className="small muted" style={{ margin: "12px 0 4px" }}>넣은 조합 {mine.length}개</p>
          <ul className="lines">{mine.map((r) => <Line key={r.id} r={r} busy={busy} onRemove={remove} />)}</ul>
        </>
      )}
      {err && <p className="err" role="alert" style={{ marginTop: 8 }}>{err}</p>}
      {ok && <p className="okmsg" style={{ marginTop: 8 }}>{ok}</p>}
    </section>
  );
}

export function PairingEditor({ drinks, foods, rows: initial, suggestions, siteUrl, brewery }: { drinks: Named[]; foods: Named[]; rows: PairingRow[]; suggestions: Suggestion[]; siteUrl: string; brewery: string }) {
  const [rows, setRows] = useState<PairingRow[]>(initial);
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>적은 페어링 {rows.length}개 · 술 {drinks.length}종</p>
      {drinks.map((d) => <DrinkBlock key={d.id} drink={d} foods={foods} rows={rows} suggestions={suggestions.filter((s) => s.drinkId === d.id)} siteUrl={siteUrl} who={`${brewery} 제공`} onChange={setRows} />)}
    </>
  );
}

/* ---------- 식당 ---------- */

export function RestaurantPairingEditor({ drinks, menu, rows: initial, suggestions, siteUrl, kakaoId, storeName }: { drinks: string[]; menu: string[]; rows: PairingRow[]; suggestions: Suggestion[]; siteUrl: string; kakaoId: string; storeName: string }) {
  const [rows, setRows] = useState<PairingRow[]>(initial);
  const [drink, setDrink] = useState("");
  const [food, setFood] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const full = rows.length >= PARTNER_PAIRING_MAX_TOTAL;
  const norm = (s: string) => s.toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
  const taken = new Set(rows.map((r) => `${norm(r.drinkText)}|${norm(r.foodText)}`));
  const sugg = useMemo(() => suggestions.filter((s) => !taken.has(`${norm(s.drinkText)}|${norm(s.foodText)}`)), [suggestions, rows.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function saveOne(drinkText: string, foodText: string, noteText: string) {
    const j = await call("POST", { drinkText, foodText, note: noteText });
    if (!j.row) throw new Error("저장하지 못했어요");
    setRows((rs) => [...rs.filter((x) => x.id !== j.row!.id), j.row!]);
  }
  async function add() {
    if (!drink.trim() || !food.trim()) return;
    setBusy(true); setErr(""); setOk("");
    try { await saveOne(drink.trim(), food.trim(), note); setOk(`${drink.trim()} × ${food.trim()} 추가했어요 — 페어링GO에 곧 보여요.`); setFood(""); setNote(""); }
    catch (e) { setErr((e as Error).message); }
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
        {!full && <SuggestList items={sugg} max={Math.min(10, PARTNER_PAIRING_MAX_TOTAL - rows.length)} busy={busy} setBusy={setBusy} keyOf={(s) => `${s.drinkText}|${s.foodText}`} showDrink who={`${storeName} 추천`} save={(s, n) => saveOne(s.drinkText, s.foodText, n)} />}
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
        {rows.length > 0 ? (
          <>
            <p className="small muted" style={{ margin: "12px 0 4px" }}>넣은 조합 {rows.length}개</p>
            <ul className="lines">{rows.map((r) => <Line key={r.id} r={r} busy={busy} onRemove={remove} showDrink />)}</ul>
          </>
        ) : <p className="muted small" style={{ margin: "8px 0 0" }}>아직 없어요. 위에서 체크하거나 직접 적어 첫 조합을 추가해 보세요.</p>}
        {err && <p className="err" role="alert" style={{ marginTop: 8 }}>{err}</p>}
        {ok && <p className="okmsg" style={{ marginTop: 8 }}>{ok}</p>}
      </section>
      <p className="small muted" style={{ margin: 0 }}>허위·과장 추천이나 우리 가게에서 팔지 않는 조합은 올리지 말아 주세요. 운영자가 지울 수 있어요.</p>
    </>
  );
}
