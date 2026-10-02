"use client";
/**
 * 판매 탭의 메뉴·술 표(2026-10-02 — 매장 정보 화면에서 옮겨 옴. 정보 화면과 판매 화면이 겹쳐 보인다는 사용자 요청).
 *  · 식당: 메뉴판(음식·음료 표 + 술 표) · 양조장: 판매하는 술 · 리쿼샵: 취급하는 술
 * 여기서 저장하면 손님 화면의 메뉴판(매장 상세·예약 화면)에 그대로 보인다. 소개·대표 사진·편의 정보는 정보 탭에서 따로 저장한다 —
 * 저장은 `part: "menu"`로 보내 정보 탭의 값은 건드리지 않는다(shared storePartInput).
 */
import { useEffect, useState } from "react";
import { MENU_SECTIONS, MENU_SECTION_LABEL, PARTNER_PLACE_LABEL, categoryOptions, isKnownCategory, mergeMenuRows, moveItem, type DrinkItem, type MenuItem, type MenuReadRow, type PartnerKind, type PlaceInfo } from "@pairinggo/shared";
import { MENU_MAX_FILES, shrinkToJpeg } from "@pairinggo/shared/image-client";

type Named = { id: string; name: string };

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

function MenuPhotoUpload({ enabled, onRows, drinkOnly }: { enabled: boolean; onRows: (rows: MenuReadRow[]) => { added: number; filled: number }; drinkOnly?: boolean }) {
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
        <b>{drinkOnly ? "술 목록 사진으로 채우기" : "메뉴판 사진으로 채우기"}</b>
        <p className="small muted" style={{ margin: "2px 0 0" }}>사진(최대 {MENU_MAX_FILES}장)을 올리면 {drinkOnly ? "술 이름과 설명·용량·도수·가격을" : "음식·술 이름과 설명·가격·용량·도수를"} 읽어 아래 표에 더해요. 적혀 있지 않은 칸은 빈칸으로 둬요. 올린 사진은 저장하지 않아요.</p>
      </div>
      {enabled ? (
        <label className={`btn primary${busy ? " is-busy" : ""}`}>
          {busy ? "읽는 중… (10~30초)" : drinkOnly ? "술 목록 사진 올리기" : "메뉴판 사진 올리기"}
          <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => { void read(e.target.files); e.target.value = ""; }} />
        </label>
      ) : <span className="chip mute">자동 읽기 준비 중 — 표에 직접 적어 주세요</span>}
      {msg.err ? <p className="err" role="alert" style={{ margin: 0 }}>{msg.err}</p> : msg.ok ? <p className="okmsg" role="status" style={{ margin: 0 }}>{msg.ok}</p> : null}
    </div>
  );
}

/**
 * 한 줄 사진 — 비어 있으면 [+ 사진], 있으면 작은 사진(누르면 바꾸기) + 빼기.
 * 긴 변 800px JPEG로 줄여 /api/menu-photo 에 올리고 주소만 표에 붙인다 — [저장]을 눌러야 페어링GO에 보인다.
 */
function PhotoCell({ img, label, onChange, onError }: { img?: string; label: string; onChange: (url: string | undefined) => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function pick(file: File | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) { onError("사진 파일을 골라 주세요"); return; }
    setBusy(true); onError("");
    try {
      const { data } = await shrinkToJpeg(file, MENU_PHOTO_EDGE);
      const r = await fetch("/api/menu-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error ?? "사진을 올리지 못했어요");
      onChange(j.url);
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className={`mimg${img ? " has" : ""}${busy ? " is-busy" : ""}`}>
      <label title={img ? "사진 바꾸기" : "사진 추가"}>
        {img ? <img src={img} alt={`${label} 사진`} /> : <span>{busy ? "…" : "+ 사진"}</span>}
        <input type="file" accept="image/*" hidden disabled={busy} aria-label={`${label || "이 줄"} 사진 ${img ? "바꾸기" : "추가"}`} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {img && !busy ? <button type="button" className="mimg-x" aria-label={`${label || "이 줄"} 사진 빼기`} onClick={() => onChange(undefined)}>×</button> : null}
    </div>
  );
}
const MENU_PHOTO_EDGE = 800;

const withImg = <T extends { img?: string }>(r: T, url: string | undefined): T => { const { img: _, ...rest } = r; return (url ? { ...rest, img: url } : rest) as T; };

/**
 * 줄 단추 — 순서 바꾸기(↑↓)와 빼기(×).
 * 손님 화면 메뉴판은 여기서 정한 순서 그대로 보인다(2026-09-22 사용자 요청).
 */
function RowOps({ index, last, label, onMove, onRemove }: { index: number; last: boolean; label: string; onMove: (d: number) => void; onRemove: () => void }) {
  const who = label.trim() || `${index + 1}번째 줄`;
  return (
    <div className="mops">
      <button type="button" aria-label={`${who} 위로`} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
      <button type="button" aria-label={`${who} 아래로`} disabled={last} onClick={() => onMove(1)}>↓</button>
      <button type="button" className="x" aria-label={`${who} 빼기`} onClick={onRemove}>×</button>
    </div>
  );
}

function MenuTable({ rows, onChange, onImg, onError }: { rows: MenuItem[]; onChange: (r: MenuItem[]) => void; onImg: (i: number, url: string | undefined) => void; onError: (m: string) => void }) {
  const set = (i: number, patch: Partial<MenuItem>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="mtable">
      <div className="mhead menu"><span>사진</span><span>이름</span><span>간단한 설명</span><span>가격(원)</span><span>구분</span><span>순서·빼기</span></div>
      {rows.map((r, i) => (
        <div className="mrow menu" key={i}>
          <PhotoCell img={r.img} label={r.name} onError={onError} onChange={(url) => onImg(i, url)} />
          <input type="text" aria-label="음식명" value={r.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} placeholder="음식명" />
          <input type="text" aria-label="간단한 설명" value={r.desc} maxLength={60} onChange={(e) => set(i, { desc: e.target.value })} placeholder="설명(없으면 비워 두세요)" />
          <NumInput value={r.price} onChange={(v) => set(i, { price: v })} parse={priceOf} unit="원" label="가격" />
          {/* 구분(2026-09-27) — 손님 메뉴판이 음식·주류·음료 탭으로 나뉜다. 술은 아래 술 표에 */}
          <select aria-label="구분" value={r.section ?? "food"} onChange={(e) => set(i, { section: e.target.value === "food" ? undefined : (e.target.value as MenuItem["section"]) })}>
            {MENU_SECTIONS.map((s) => <option key={s} value={s}>{MENU_SECTION_LABEL[s]}</option>)}
          </select>
          <RowOps index={i} last={i === rows.length - 1} label={r.name} onMove={(d) => onChange(moveItem(rows, i, d))} onRemove={() => onChange(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { name: "", desc: "", price: null }])}>+ 음식 줄 추가</button>
        <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { name: "", desc: "", price: null, section: "beverage" }])}>+ 음료 줄 추가</button>
        <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { name: "", desc: "", price: null, section: "other" }])}>+ 기타 줄 추가</button>
        <span className="small muted">술은 아래 술 표에 적어 주세요 — 손님 메뉴판에 음식·주류·음료·기타 탭으로 보여요.</span>
      </div>
    </div>
  );
}

function DrinkTable({ rows, onChange, onImg, onError, withDesc }: { rows: DrinkItem[]; onChange: (r: DrinkItem[]) => void; onImg: (i: number, url: string | undefined) => void; onError: (m: string) => void; withDesc?: boolean }) {
  const set = (i: number, patch: Partial<DrinkItem>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // 술만 파는 곳(양조장·리쿼샵)은 술을 소개할 설명 칸이 하나 더 있다(2026-09-21)
  const cls = withDesc ? "drink desc" : "drink";
  return (
    <div className="mtable">
      <div className={`mhead ${cls}`}>
        <span>사진</span><span>술 이름</span><span>종류</span>{withDesc ? <span>설명</span> : null}<span>용량</span><span>도수(%)</span><span>가격(원)</span><span>순서·빼기</span>
      </div>
      {rows.map((r, i) => (
        <div className={`mrow ${cls}`} key={i}>
          <PhotoCell img={r.img} label={r.name} onError={onError} onChange={(url) => onImg(i, url)} />
          <input type="text" aria-label="술 이름" value={r.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} placeholder="술 이름" />
          {/* 술 종류(2026-09-25) — 주종별 묶음. 모르면 비워 둔다 */}
          <select aria-label="종류" value={r.category ?? ""} onChange={(e) => set(i, { category: e.target.value || undefined })}>
            <option value="">종류 선택</option>
            {categoryOptions().map((g) => <optgroup key={g.kind} label={g.label}>{g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
          </select>
          {withDesc ? <input type="text" aria-label="설명" value={r.desc ?? ""} maxLength={60} onChange={(e) => set(i, { desc: e.target.value })} placeholder="예: 백일 동안 빚는 약주" /> : null}
          <input type="text" aria-label="용량" value={r.volume} maxLength={20} onChange={(e) => set(i, { volume: e.target.value })} placeholder="750ml·잔" />
          <NumInput value={r.abv} onChange={(v) => set(i, { abv: v })} parse={abvOf} unit="%" label="도수" decimal />
          <NumInput value={r.price} onChange={(v) => set(i, { price: v })} parse={priceOf} unit="원" label="가격" />
          <RowOps index={i} last={i === rows.length - 1} label={r.name} onMove={(d) => onChange(moveItem(rows, i, d))} onRemove={() => onChange(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { name: "", volume: "", abv: null, price: null }])}>+ 술 줄 추가</button>
    </div>
  );
}

/** 업종별 제목·안내 */
const TITLE: Record<PartnerKind, string> = { restaurant: "메뉴판", brewery: "판매하는 술", liquor: "취급하는 술" };

export function MenuForm({ info, drinks, foods, menuReadEnabled, kind = "restaurant", brewery = "", ourDrinks = [], infoLabel }: { info: PlaceInfo | null; drinks: Named[]; foods: Named[]; menuReadEnabled: boolean; kind?: PartnerKind; brewery?: string; ourDrinks?: { id: string; name: string; abv: number | null; category?: string }[]; infoLabel: string }) {
  const [tables, setTables] = useState(() => initialTables(info, drinks, foods));
  // 양조장·리쿼샵은 음식 메뉴가 없다 — 술 표만 쓰고, 술마다 설명을 받는다
  const drinkOnly = kind !== "restaurant";
  const placeLabel = PARTNER_PLACE_LABEL[kind];
  /** 카탈로그에 있는 우리 양조장 술을 표에 한 번에 더한다(이미 적은 이름은 건드리지 않는다) */
  const addOurDrinks = () => setTables((t) => {
    const key = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const have = new Set(t.drinks.map((d) => key(d.name)));
    const add = ourDrinks.filter((d) => !have.has(key(d.name))).map((d) => ({ name: d.name, volume: "", abv: d.abv, price: null, ...(isKnownCategory(d.category) ? { category: d.category } : {}) }));   // 카탈로그 종류(탁주·약주…)를 함께 채운다(2026-09-27)
    return add.length ? { ...t, drinks: [...t.drinks.filter((d) => d.name.trim()), ...add] } : t;
  });
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});
  const [photoErr, setPhotoErr] = useState("");

  async function save() {
    setState({ busy: true });
    const menuItems = drinkOnly ? [] : tables.menu.filter((m) => m.name.trim()), drinkItems = tables.drinks.filter((d) => d.name.trim());
    const r = await fetch("/api/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ part: "menu", info: { menuItems, drinkItems } }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setState(r?.ok ? { ok: `저장했어요 — 페어링GO ${placeLabel} 화면의 메뉴판에 바로 반영돼요(목록 캐시로 최대 10분)` } : { err: j?.error ?? "저장하지 못했어요" });
  }

  return (
    <div className="stack">
      {/* 양조장·리쿼샵은 음식 메뉴가 없다 — 술만 적는다(2026-09-21 사용자 요청) */}
      <section className="panel stack">
        <div>
          <h2 style={{ margin: 0 }}>{TITLE[kind]}</h2>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            {kind === "restaurant" ? "우리 가게에서 파는 음식과 술이에요. 손님 화면의 메뉴판에 이 순서대로 보여요."
              : kind === "brewery" ? "양조장에서 파는 술이에요(방문 구매·시음 포함). 손님 화면의 양조장 메뉴판에 이 순서대로 보이고, 이 술 이름으로 검색하면 우리 양조장이 나와요."
              : "매장에서 취급하는 술이에요. 손님 화면의 메뉴판에 이 순서대로 보이고, 이 술 이름으로 검색하면 우리 매장이 나와요."}
          </p>
        </div>
        <MenuPhotoUpload enabled={menuReadEnabled} drinkOnly={drinkOnly} onRows={(rows) => {
          const use = drinkOnly ? rows.filter((r) => r.kind === "drink") : rows;
          const m = mergeMenuRows({ menu: tables.menu, drinks: tables.drinks }, use, { drinks, foods });
          setTables({ menu: m.menu, drinks: m.drinks });
          return m;
        }} />
        <p className="small muted" style={{ margin: 0 }}>
          줄마다 <b>+ 사진</b>을 눌러 사진을 붙일 수 있어요. 손님 화면에 사진·이름·설명·용량·도수·가격이 함께 보여요.
          직접 찍었거나 쓸 권리가 있는 사진만 올려 주세요.
        </p>
        {photoErr ? <p className="err" role="alert" style={{ margin: 0 }}>{photoErr}</p> : null}
        {!drinkOnly ? (
          <div>
            <h3 className="mtitle">메뉴 <span className="muted small">{tables.menu.length}개</span></h3>
            <MenuTable rows={tables.menu} onError={setPhotoErr} onImg={(i, url) => setTables((t) => ({ ...t, menu: t.menu.map((x, j) => (j === i ? withImg(x, url) : x)) }))} onChange={(menu) => setTables((t) => ({ ...t, menu }))} />
          </div>
        ) : null}
        <div>
          <div className="mtitle-row">
            <h3 className="mtitle">술 <span className="muted small">{tables.drinks.length}개</span></h3>
            {kind === "brewery" && ourDrinks.length ? (
              <button type="button" className="btn ghost sm" onClick={addOurDrinks}>
                우리 술 {ourDrinks.length}종 불러오기
              </button>
            ) : null}
          </div>
          <DrinkTable withDesc={drinkOnly} rows={tables.drinks} onError={setPhotoErr} onImg={(i, url) => setTables((t) => ({ ...t, drinks: t.drinks.map((x, j) => (j === i ? withImg(x, url) : x)) }))} onChange={(d) => setTables((t) => ({ ...t, drinks: d }))} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {kind === "brewery" && !brewery ? `${infoLabel}에서 ‘우리 양조장’을 고르면 페어링GO에 있는 우리 술을 한 번에 불러올 수 있어요. ` : ""}
          페어링GO에 있는 {drinkOnly ? "전통주와" : "음식·전통주와"} 이름이 같으면 손님 화면에서 그 페이지로 이어져요.
        </p>
      </section>

      {state.err ? <p className="err" role="alert">{state.err}</p> : null}
      {state.ok ? <p className="okmsg" role="status">{state.ok}</p> : null}
      <button className="btn primary block" disabled={state.busy} onClick={save}>{state.busy ? "저장하는 중…" : `${TITLE[kind]} 저장`}</button>
    </div>
  );
}
