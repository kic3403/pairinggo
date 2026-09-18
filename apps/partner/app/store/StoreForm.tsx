"use client";
import { useEffect, useState } from "react";
import { cleanNaverUrl, formatPrice, mergeMenuRows, placeChips, type DrinkItem, type MenuItem, type MenuReadRow, type PlaceInfo } from "@pairinggo/shared";
import { MENU_MAX_FILES, shrinkToJpeg } from "@pairinggo/shared/image-client";

type Named = { id: string; name: string };

const PARKING = [["", "모름"], ["free", "무료 주차"], ["paid", "유료 주차"], ["valet", "발레 파킹"], ["street", "근처 노상·공영"], ["none", "주차 불가"]] as const;
const TRI = [["", "모름"], ["yes", "가능"], ["no", "불가"]] as const;

/** 가격 칸 — 숫자만 받아 원 단위로. 비우면 빈칸(null) */
const priceOf = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 8); return d ? Number(d) : null; };
/** 도수 칸 — 숫자와 소수점만. 비우면 빈칸(null) */
const abvOf = (v: string) => { const s = v.replace(/[^\d.]/g, "").slice(0, 4); const n = Number(s); return s && Number.isFinite(n) && n <= 80 ? n : null; };

/** 숫자 칸 — 치는 중인 글자("6.")는 그대로 두고, 값(숫자·빈칸)만 위로 올린다. 사진 읽기로 값이 바뀌면 따라간다 */
function NumInput({ value, onChange, parse, unit, label, decimal }: { value: number | null; onChange: (v: number | null) => void; parse: (s: string) => number | null; unit: string; label: string; decimal?: boolean }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => { if (parse(text) !== value) setText(value == null ? "" : String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className="unit" data-u={unit}>
      <input type="text" aria-label={`${label}(${unit})`} inputMode={decimal ? "decimal" : "numeric"} className="num" value={text} placeholder={label}
        onChange={(e) => { const t = e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ""); setText(t); onChange(parse(t)); }} />
    </span>
  );
}

/** 예전에 이름만 적어 둔 매장(운영자 입력)은 이름으로 표를 시작한다 */
function initialTables(info: PlaceInfo | null, drinks: Named[], foods: Named[]) {
  const DN = new Map(drinks.map((d) => [d.id, d.name])), FN = new Map(foods.map((f) => [f.id, f.name]));
  const menu: MenuItem[] = info?.menuItems.length ? info.menuItems
    : [...(info?.foods ?? []).map((id) => FN.get(id) ?? "").filter(Boolean), ...(info?.menuNames ?? [])].map((name) => ({ name, desc: "", price: null }));
  const drinkRows: DrinkItem[] = info?.drinkItems.length ? info.drinkItems
    : [...(info?.drinks ?? []).map((id) => DN.get(id) ?? "").filter(Boolean), ...(info?.drinkNames ?? [])].map((name) => ({ name, volume: "", abv: null, price: null }));
  return { menu, drinks: drinkRows };
}

function MenuPhotoUpload({ enabled, onRows }: { enabled: boolean; onRows: (rows: MenuReadRow[]) => { added: number; filled: number } }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  async function read(files: FileList | null) {
    if (!files?.length || busy) return;
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, MENU_MAX_FILES);
    if (!list.length) { setMsg({ err: "사진 파일을 골라 주세요" }); return; }
    setBusy(true); setMsg({});
    try {
      const images = await Promise.all(list.map((f) => shrinkToJpeg(f)));
      const r = await fetch("/api/menu-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
      const j = (await r.json().catch(() => ({}))) as { items?: MenuReadRow[]; note?: string; error?: string; left?: number };
      if (!r.ok) throw new Error(j.error ?? "읽지 못했어요");
      const items = j.items ?? [];
      const m = onRows(items);
      const d = items.filter((i) => i.kind === "drink").length;
      setMsg({ ok: items.length
        ? `메뉴 ${items.length - d}개 · 술 ${d}개를 읽었어요 → 새로 ${m.added}줄${m.filled ? `, 빈칸 ${m.filled}곳 채움` : ""}. 틀린 곳을 고친 뒤 아래 [저장]을 눌러 주세요.${files.length > MENU_MAX_FILES ? ` (앞의 ${MENU_MAX_FILES}장만 읽었어요)` : ""}`
        : `읽은 항목이 없어요.${j.note ? ` ${j.note}` : ""}` });
    } catch (e) { setMsg({ err: (e as Error).message }); } finally { setBusy(false); }
  }
  return (
    <div className="mphoto">
      <div>
        <b>메뉴판 사진으로 채우기</b>
        <p className="small muted" style={{ margin: "2px 0 0" }}>사진(최대 {MENU_MAX_FILES}장)을 올리면 음식·술 이름과 설명·가격·용량·도수를 읽어 아래 표에 더해요. 적혀 있지 않은 칸은 빈칸으로 둬요. 사진은 저장하지 않아요.</p>
      </div>
      {enabled ? (
        <label className={`btn primary${busy ? " is-busy" : ""}`}>
          {busy ? "읽는 중… (10~30초)" : "메뉴판 사진 올리기"}
          <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => { void read(e.target.files); e.target.value = ""; }} />
        </label>
      ) : <span className="chip mute">자동 읽기 준비 중 — 표에 직접 적어 주세요</span>}
      {msg.err ? <p className="err" role="alert" style={{ margin: 0 }}>{msg.err}</p> : msg.ok ? <p className="okmsg" role="status" style={{ margin: 0 }}>{msg.ok}</p> : null}
    </div>
  );
}

function MenuTable({ rows, onChange }: { rows: MenuItem[]; onChange: (r: MenuItem[]) => void }) {
  const set = (i: number, patch: Partial<MenuItem>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="mtable">
      <div className="mhead menu"><span>음식명</span><span>간단한 설명</span><span>가격(원)</span><span /></div>
      {rows.map((r, i) => (
        <div className="mrow menu" key={i}>
          <input type="text" aria-label="음식명" value={r.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} placeholder="음식명" />
          <input type="text" aria-label="간단한 설명" value={r.desc} maxLength={60} onChange={(e) => set(i, { desc: e.target.value })} placeholder="설명(없으면 비워 두세요)" />
          <NumInput value={r.price} onChange={(v) => set(i, { price: v })} parse={priceOf} unit="원" label="가격" />
          <button type="button" className="mdel" aria-label={`${r.name || "이 줄"} 빼기`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { name: "", desc: "", price: null }])}>+ 메뉴 줄 추가</button>
    </div>
  );
}

function DrinkTable({ rows, onChange }: { rows: DrinkItem[]; onChange: (r: DrinkItem[]) => void }) {
  const set = (i: number, patch: Partial<DrinkItem>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="mtable">
      <div className="mhead drink"><span>술 이름</span><span>용량</span><span>도수(%)</span><span>가격(원)</span><span /></div>
      {rows.map((r, i) => (
        <div className="mrow drink" key={i}>
          <input type="text" aria-label="술 이름" value={r.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} placeholder="술 이름" />
          <input type="text" aria-label="용량" value={r.volume} maxLength={20} onChange={(e) => set(i, { volume: e.target.value })} placeholder="750ml·잔" />
          <NumInput value={r.abv} onChange={(v) => set(i, { abv: v })} parse={abvOf} unit="%" label="도수" decimal />
          <NumInput value={r.price} onChange={(v) => set(i, { price: v })} parse={priceOf} unit="원" label="가격" />
          <button type="button" className="mdel" aria-label={`${r.name || "이 줄"} 빼기`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { name: "", volume: "", abv: null, price: null }])}>+ 술 줄 추가</button>
    </div>
  );
}

export function StoreForm({ phone: phone0, info, drinks, foods, siteUrl, kakaoId, menuReadEnabled }: { phone: string; info: PlaceInfo | null; drinks: Named[]; foods: Named[]; siteUrl: string; kakaoId: string; menuReadEnabled: boolean }) {
  const [phone, setPhone] = useState(phone0);
  const [f, setF] = useState({
    menuNote: info?.menuNote ?? "", parking: info?.parking ?? "", parkingNote: info?.parkingNote ?? "",
    corkage: info?.corkage ?? "", corkageNote: info?.corkageNote ?? "", room: info?.room ?? "", roomNote: info?.roomNote ?? "", naverUrl: info?.naverUrl ?? "",
  });
  const [tables, setTables] = useState(() => initialTables(info, drinks, foods));
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const preview: PlaceInfo = {
    ...f, parking: (f.parking || null) as PlaceInfo["parking"], corkage: (f.corkage || null) as PlaceInfo["corkage"], room: (f.room || null) as PlaceInfo["room"],
    drinks: [], drinkNames: [], foods: [], menuNames: [], menuItems: tables.menu, drinkItems: tables.drinks, naverUrl: cleanNaverUrl(f.naverUrl), source: "partner", verifiedAt: null,
  };
  const chips = placeChips(preview, null);

  async function save() {
    if (f.naverUrl.trim() && !cleanNaverUrl(f.naverUrl)) { setState({ err: "네이버 지도 링크는 https://naver.me/… 또는 https://map.naver.com/… 모양만 받아요" }); return; }
    setState({ busy: true });
    const menuItems = tables.menu.filter((m) => m.name.trim()), drinkItems = tables.drinks.filter((d) => d.name.trim());
    const r = await fetch("/api/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, info: { ...f, menuItems, drinkItems } }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setState(r?.ok ? { ok: "저장했어요 — 페어링GO 식당 목록과 예약 화면에 바로 반영돼요(목록 캐시로 최대 10분)" } : { err: j?.error ?? "저장하지 못했어요" });
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <label className="f">매장 대표 번호 <span className="hint">손님 예약 화면·확정 안내에 보여요</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="042-000-0000" maxLength={20} />
        </label>
        <label className="f">한 줄 소개 <span className="hint">120자 — 페어링GO 식당 카드에 그대로 보여요</span>
          <textarea value={f.menuNote} onChange={set("menuNote")} maxLength={120} placeholder="예: 대전 한우 수육과 지역 막걸리를 함께 내는 한식 주점" />
        </label>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>메뉴판</h2>
        <MenuPhotoUpload enabled={menuReadEnabled} onRows={(rows) => {
          const m = mergeMenuRows({ menu: tables.menu, drinks: tables.drinks }, rows, { drinks, foods });
          setTables({ menu: m.menu, drinks: m.drinks });
          return m;
        }} />
        <div>
          <h3 className="mtitle">메뉴 <span className="muted small">{tables.menu.length}개</span></h3>
          <MenuTable rows={tables.menu} onChange={(menu) => setTables({ ...tables, menu })} />
        </div>
        <div>
          <h3 className="mtitle">술 <span className="muted small">{tables.drinks.length}개</span></h3>
          <DrinkTable rows={tables.drinks} onChange={(d) => setTables({ ...tables, drinks: d })} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>페어링GO에 있는 음식·전통주와 이름이 같으면 손님 화면에서 그 페이지로 이어져요.</p>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>편의 정보</h2>
        {([["parking", "주차", PARKING, "parkingNote", "예: 건물 뒤 5대"], ["corkage", "콜키지(술 가져오기)", TRI, "corkageNote", "예: 병당 1만원, 전통주 무료"], ["room", "룸", TRI, "roomNote", "예: 8인 룸 1개"]] as const).map(([k, label, opts, nk, ph]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 8, alignItems: "end" }}>
            <label className="f">{label}
              <select value={f[k]} onChange={set(k)}>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </label>
            <label className="f"><span className="hint">덧붙일 말(40자)</span><input type="text" value={f[nk]} onChange={set(nk)} maxLength={40} placeholder={ph} /></label>
          </div>
        ))}
        <label className="f">네이버 지도 링크 <span className="hint">선택 — 손님이 누르면 네이버 지도로 가요</span>
          <input type="text" value={f.naverUrl} onChange={set("naverUrl")} placeholder="https://naver.me/…" inputMode="url" />
        </label>
      </section>

      <section className="panel">
        <p className="small muted" style={{ marginBottom: 8 }}>페어링GO 식당 카드에 이렇게 보여요</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips.length ? chips.map((c) => <span key={c.key} className={`chip${c.tone === "no" ? " mute" : ""}`}>{c.label}</span>) : <span className="muted small">편의 정보를 고르면 칩이 생겨요</span>}
        </div>
        {tables.menu.some((m) => m.price != null) ? <p className="small" style={{ margin: "8px 0 0" }}>메뉴 예: {tables.menu.filter((m) => m.name).slice(0, 3).map((m) => `${m.name}${m.price != null ? ` ${formatPrice(m.price)}` : ""}`).join(" · ")}</p> : null}
        <p className="small" style={{ margin: "8px 0 0" }}><a href={`${siteUrl}/`} target="_blank" rel="noreferrer">페어링GO 열기 ↗</a> <span className="muted">· 매장 id {kakaoId}</span></p>
      </section>

      {state.err ? <p className="err" role="alert">{state.err}</p> : null}
      {state.ok ? <p className="okmsg" role="status">{state.ok}</p> : null}
      <button className="btn primary block" disabled={state.busy} onClick={save}>{state.busy ? "저장하는 중…" : "저장"}</button>
    </div>
  );
}
