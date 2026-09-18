"use client";
import { useState } from "react";
import { addListItem, cleanNaverUrl, placeChips, type PlaceInfo } from "@pairinggo/shared";

type Named = { id: string; name: string };
type List = { ids: string[]; names: string[] };

const PARKING = [["", "모름"], ["free", "무료 주차"], ["paid", "유료 주차"], ["valet", "발레 파킹"], ["street", "근처 노상·공영"], ["none", "주차 불가"]] as const;
const TRI = [["", "모름"], ["yes", "가능"], ["no", "불가"]] as const;

function ListAdder({ label, hint, list, catalog, onChange }: { label: string; hint: string; list: List; catalog: Named[]; onChange: (l: List) => void }) {
  const [v, setV] = useState("");
  const [msg, setMsg] = useState("");
  const byId = new Map(catalog.map((c) => [c.id, c.name]));
  function add() {
    const r = addListItem(list, v, catalog);
    setMsg(r.added ? "" : v.trim() ? "이미 있어요" : "");
    if (r.added) { onChange({ ids: r.ids, names: r.names }); setV(""); }
  }
  const items = [...list.ids.map((id) => ({ key: id, text: byId.get(id) ?? id, linked: true })), ...list.names.map((n) => ({ key: `n:${n}`, text: n, linked: false }))];
  return (
    <div className="f" style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink2)" }}>{label} <span className="hint">{hint}</span></span>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="text" value={v} list={`${label}-cat`} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="이름 적고 추가" maxLength={30} />
        <button type="button" className="btn ghost" onClick={add}>추가</button>
      </div>
      <datalist id={`${label}-cat`}>{catalog.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      {msg ? <span className="hint">{msg}</span> : null}
      {items.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((it) => (
            <span key={it.key} className={`chip${it.linked ? "" : " mute"}`}>
              {it.text}
              <button type="button" aria-label={`${it.text} 빼기`} onClick={() => onChange(it.linked ? { ...list, ids: list.ids.filter((x) => x !== it.key) } : { ...list, names: list.names.filter((x) => `n:${x}` !== it.key) })}
                style={{ background: "none", border: 0, padding: "0 0 0 2px", cursor: "pointer", color: "inherit", font: "inherit" }}>×</button>
            </span>
          ))}
        </div>
      ) : <span className="hint">아직 없어요</span>}
    </div>
  );
}

export function StoreForm({ phone: phone0, info, drinks, foods, siteUrl, kakaoId }: { phone: string; info: PlaceInfo | null; drinks: Named[]; foods: Named[]; siteUrl: string; kakaoId: string }) {
  const [phone, setPhone] = useState(phone0);
  const [f, setF] = useState({
    menuNote: info?.menuNote ?? "", parking: info?.parking ?? "", parkingNote: info?.parkingNote ?? "",
    corkage: info?.corkage ?? "", corkageNote: info?.corkageNote ?? "", room: info?.room ?? "", roomNote: info?.roomNote ?? "", naverUrl: info?.naverUrl ?? "",
  });
  const [dl, setDl] = useState<List>({ ids: info?.drinks ?? [], names: info?.drinkNames ?? [] });
  const [fl, setFl] = useState<List>({ ids: info?.foods ?? [], names: info?.menuNames ?? [] });
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const preview: PlaceInfo = { ...f, parking: (f.parking || null) as PlaceInfo["parking"], corkage: (f.corkage || null) as PlaceInfo["corkage"], room: (f.room || null) as PlaceInfo["room"], drinks: dl.ids, drinkNames: dl.names, foods: fl.ids, menuNames: fl.names, naverUrl: cleanNaverUrl(f.naverUrl), source: "partner", verifiedAt: null };
  const chips = placeChips(preview, null);

  async function save() {
    if (f.naverUrl.trim() && !cleanNaverUrl(f.naverUrl)) { setState({ err: "네이버 지도 링크는 https://naver.me/… 또는 https://map.naver.com/… 모양만 받아요" }); return; }
    setState({ busy: true });
    const r = await fetch("/api/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, info: { ...f, drinks: dl.ids, drinkNames: dl.names, foods: fl.ids, menuNames: fl.names } }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setState(r?.ok ? { ok: "저장했어요 — 페어링GO 식당 목록에 바로 반영돼요(목록 캐시로 최대 10분)" } : { err: j?.error ?? "저장하지 못했어요" });
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

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>술·메뉴</h2>
        <ListAdder label="술 종류" hint="페어링GO에 있는 전통주 이름과 같으면 그 술 페이지로 이어져요" list={dl} catalog={drinks} onChange={setDl} />
        <ListAdder label="메뉴" hint="대표 메뉴 — 같은 음식이 페어링GO에 있으면 연결돼요" list={fl} catalog={foods} onChange={setFl} />
      </section>

      <section className="panel">
        <p className="small muted" style={{ marginBottom: 8 }}>페어링GO 식당 카드에 이렇게 보여요</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips.length ? chips.map((c) => <span key={c.key} className={`chip${c.tone === "no" ? " mute" : ""}`}>{c.label}</span>) : <span className="muted small">편의 정보를 고르면 칩이 생겨요</span>}
        </div>
        <p className="small" style={{ margin: "8px 0 0" }}><a href={`${siteUrl}/`} target="_blank" rel="noreferrer">페어링GO 열기 ↗</a> <span className="muted">· 매장 id {kakaoId}</span></p>
      </section>

      {state.err ? <p className="err" role="alert">{state.err}</p> : null}
      {state.ok ? <p className="okmsg" role="status">{state.ok}</p> : null}
      <button className="btn primary block" disabled={state.busy} onClick={save}>{state.busy ? "저장하는 중…" : "저장"}</button>
    </div>
  );
}
