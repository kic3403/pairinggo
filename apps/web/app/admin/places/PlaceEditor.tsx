"use client";
/** 식당 정보 입력 — ① 카카오에서 식당 찾기 ② 확인한 내용 적기 ③ 저장. 아래 목록에서 고치거나 지운다. 표시 규칙은 shared place-info.ts */
import { useMemo, useState } from "react";
import { addListItem, cleanNaverUrl, placeChips, placeNoteLine, verifiedLabel, type PlaceInfo } from "@pairinggo/shared";
import type { PlaceInfoRow } from "@/lib/place-info";

type Found = { id: string; name: string; category?: string; address: string; phone: string | null; lat?: number; lng?: number; placeUrl: string | null };
type Item = { id: string; name: string };
type Form = { parking: string; parkingNote: string; corkage: string; corkageNote: string; room: string; roomNote: string; drinks: string[]; drinkNames: string[]; foods: string[]; menuNames: string[]; menuNote: string; naverUrl: string; contactPhone: string; verifiedAt: string; memo: string };

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: Form = { parking: "", parkingNote: "", corkage: "", corkageNote: "", room: "", roomNote: "", drinks: [], drinkNames: [], foods: [], menuNames: [], menuNote: "", naverUrl: "", contactPhone: "", verifiedAt: today(), memo: "" };
const fromRow = (r: PlaceInfoRow): Form => ({
  parking: r.info.parking ?? "", parkingNote: r.info.parkingNote, corkage: r.info.corkage ?? "", corkageNote: r.info.corkageNote, room: r.info.room ?? "", roomNote: r.info.roomNote,
  drinks: r.info.drinks, drinkNames: r.info.drinkNames, foods: r.info.foods, menuNames: r.info.menuNames, menuNote: r.info.menuNote, naverUrl: r.info.naverUrl ?? "", contactPhone: r.contactPhone,
  verifiedAt: r.info.verifiedAt ?? today(), memo: r.memo,
});

export default function PlaceEditor({ rows: initial, drinks, foods }: { rows: PlaceInfoRow[]; drinks: Item[]; foods: Item[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState(""); const [found, setFound] = useState<Found[] | null>(null); const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<Found | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false); const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dName = useMemo(() => new Map(drinks.map((d) => [d.id, d.name])), [drinks]), fName = useMemo(() => new Map(foods.map((f) => [f.id, f.name])), [foods]);

  const search = async () => {
    if (q.trim().length < 2) { say("식당 이름이나 ‘대전 둔산동 해물파전’처럼 두 글자 이상 적어 주세요"); return; }
    setSearching(true);
    try { const j = await (await fetch(`/admin/api/places/search?q=${encodeURIComponent(q.trim())}`)).json(); setFound(j.places ?? []); if (j.error) say(j.error); }
    catch { say("검색에 실패했어요"); } finally { setSearching(false); }
  };
  const pick = (p: Found) => {
    const has = rows.find((r) => r.kakaoId === p.id);
    setPlace(p); setForm(has ? fromRow(has) : { ...EMPTY, verifiedAt: today() }); setFound(null);
    if (has) say("이미 입력한 식당이에요 — 고쳐서 저장하면 덮어씁니다");
  };
  const edit = (r: PlaceInfoRow) => { setPlace({ id: r.kakaoId, name: r.name, address: r.address, phone: r.phone, placeUrl: r.placeUrl }); setForm(fromRow(r)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const save = async () => {
    if (!place || busy) return;
    setBusy(true);
    try {
      const { memo, contactPhone, ...info } = form;
      if (form.naverUrl.trim() && !cleanNaverUrl(form.naverUrl)) throw new Error("네이버 링크는 https://naver.me/… 또는 https://map.naver.com/… 주소만 넣을 수 있어요");
      const res = await fetch("/admin/api/places", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place, info, contactPhone, memo, updatedBy: localStorage.getItem("pgo_reviewer") || "운영자" }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setRows((rs) => [j.row as PlaceInfoRow, ...rs.filter((r) => r.kakaoId !== place.id)]);
      setPlace(null); setForm(EMPTY); say("저장했어요 — 맛집 목록에 10분 안에 반영됩니다");
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (r: PlaceInfoRow) => {
    if (!confirm(`${r.name}의 식당 정보를 지울까요? 공개 화면에서도 사라집니다.`)) return;
    const res = await fetch(`/admin/api/places?id=${encodeURIComponent(r.kakaoId)}`, { method: "DELETE" });
    if (res.ok) { setRows((rs) => rs.filter((x) => x.kakaoId !== r.kakaoId)); say("지웠어요"); } else say("지우지 못했어요");
  };

  const preview: PlaceInfo = { parking: (form.parking || null) as PlaceInfo["parking"], parkingNote: form.parkingNote, corkage: (form.corkage || null) as PlaceInfo["corkage"], corkageNote: form.corkageNote, room: (form.room || null) as PlaceInfo["room"], roomNote: form.roomNote, drinks: form.drinks, drinkNames: form.drinkNames, foods: form.foods, menuNames: form.menuNames, menuNote: form.menuNote, naverUrl: cleanNaverUrl(form.naverUrl), source: "operator", verifiedAt: form.verifiedAt };

  return (
    <>
      <div className="card">
        <b>① 식당 찾기</b>
        <div className="row" style={{ marginTop: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="식당 이름 또는 ‘대전 둔산동 해물파전’" style={{ flex: 1, minWidth: 220 }} />
          <button className="btn p" onClick={() => void search()} disabled={searching}>{searching ? "찾는 중…" : "카카오에서 찾기"}</button>
        </div>
        {found && (found.length ? (
          <div style={{ marginTop: 8 }}>
            {found.map((p) => (
              <div key={p.id} className="row" style={{ padding: "6px 0", borderTop: "1px solid var(--line)", justifyContent: "space-between" }}>
                <span><b>{p.name}</b> <span className="muted">{p.category} · {p.address}</span>{rows.some((r) => r.kakaoId === p.id) && <span className="tag g" style={{ marginLeft: 6 }}>입력됨</span>}</span>
                <button className="btn sm" onClick={() => pick(p)}>이 식당</button>
              </div>
            ))}
          </div>
        ) : <p className="muted" style={{ marginTop: 8 }}>결과가 없어요. 지역 이름을 함께 적어 보세요.</p>)}
      </div>

      {place && (
        <div className="card sel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><b>② {place.name}</b> <span className="muted">{place.address}{place.phone ? ` · ${place.phone}` : ""}</span> {place.placeUrl && <a href={place.placeUrl} target="_blank" rel="noopener">카카오맵 ↗</a>}</div>
            <button className="btn sm" onClick={() => { setPlace(null); setForm(EMPTY); }}>취소</button>
          </div>
          <div className="grid3" style={{ marginTop: 10 }}>
            <div><label>콜키지</label><select value={form.corkage} onChange={(e) => set("corkage", e.target.value)}><option value="">모름(표시 안 함)</option><option value="yes">가능</option><option value="no">불가</option></select>
              <input value={form.corkageNote} onChange={(e) => set("corkageNote", e.target.value)} placeholder="예) 병당 1만원 · 전통주 무료" maxLength={40} style={{ marginTop: 6 }} /></div>
            <div><label>룸</label><select value={form.room} onChange={(e) => set("room", e.target.value)}><option value="">모름(표시 안 함)</option><option value="yes">있음</option><option value="no">없음</option></select>
              <input value={form.roomNote} onChange={(e) => set("roomNote", e.target.value)} placeholder="예) 6인실 2개 · 예약 필수" maxLength={40} style={{ marginTop: 6 }} /></div>
            <div><label>주차</label><select value={form.parking} onChange={(e) => set("parking", e.target.value)}><option value="">모름(구글 정보 사용)</option><option value="free">무료</option><option value="paid">유료</option><option value="valet">발레파킹</option><option value="street">노상 주차</option><option value="none">불가</option></select>
              <input value={form.parkingNote} onChange={(e) => set("parkingNote", e.target.value)} placeholder="예) 건물 지하 2시간 무료" maxLength={40} style={{ marginTop: 6 }} /></div>
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <ListAdder label="술 종류" placeholder="예) 한산소곡주, 하우스 와인" catalog={drinks} ids={form.drinks} names={form.drinkNames} nameOf={dName} tone="" onChange={(ids, names) => setForm((f) => ({ ...f, drinks: ids, drinkNames: names }))} say={say} />
            <ListAdder label="메뉴" placeholder="예) 해물파전, 모둠전" catalog={foods} ids={form.foods} names={form.menuNames} nameOf={fName} tone="v" onChange={(ids, names) => setForm((f) => ({ ...f, foods: ids, menuNames: names }))} say={say} />
          </div>
          <p className="muted" style={{ margin: "6px 0 0" }}>이름을 적고 <b>추가</b>를 누르세요(Enter도 됩니다). 페어링GO에 있는 술·음식이면 자동으로 연결되어 화면에서 그 페이지로 이어지고(색 있는 칩), 없는 것은 적은 이름 그대로 보입니다(회색 칩). 칩을 누르면 빠져요.</p>
          <div style={{ marginTop: 10 }}><label>한 줄 소개 (화면에 보임, 120자)</label><input value={form.menuNote} onChange={(e) => set("menuNote", e.target.value)} maxLength={120} placeholder="예) 전통주 30여 종 · 잔술 가능 · 제철 해산물 전문" /></div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div><label>네이버 지도 링크 (화면에 “네이버 지도 ↗”로 보임)</label><input value={form.naverUrl} onChange={(e) => set("naverUrl", e.target.value)} maxLength={300} placeholder="https://naver.me/… 또는 https://map.naver.com/…" inputMode="url" /></div>
            <div><label>식당 대표 번호 — 운영자만 봄(화면에 안 보임)</label><input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} maxLength={20} placeholder="예) 042-123-4567" inputMode="tel" /></div>
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div><label>확인한 날</label><input type="date" value={form.verifiedAt} onChange={(e) => set("verifiedAt", e.target.value)} /></div>
            <div><label>운영 메모 (화면에 안 보임)</label><input value={form.memo} onChange={(e) => set("memo", e.target.value)} maxLength={300} placeholder="예) 점장님 통화 · 입점 관심 있음" /></div>
          </div>
          <div className="quote" style={{ marginTop: 12 }}>
            <span className="muted">화면에 이렇게 보여요 — </span><b>{place.name}</b>{" "}
            {placeChips(preview, null).map((c) => <span key={c.key} className={`tag ${c.tone === "yes" ? "g" : "m"}`} style={{ marginRight: 4 }}>{c.label}</span>)}
            <span className="muted">{verifiedLabel(preview)}</span>
            {placeNoteLine(preview) && <div className="muted">{placeNoteLine(preview)}</div>}
            {(form.drinks.length > 0 || form.drinkNames.length > 0) && <div>술: {[...form.drinks.map((id) => dName.get(id) ?? id), ...form.drinkNames].join(" · ")}</div>}
            {(form.foods.length > 0 || form.menuNames.length > 0) && <div>메뉴: {[...form.foods.map((id) => fName.get(id) ?? id), ...form.menuNames].join(" · ")}</div>}
            {form.menuNote && <div>{form.menuNote}</div>}
            {cleanNaverUrl(form.naverUrl) && <div className="muted">+ “네이버 지도 ↗” 링크</div>}
          </div>
          <div className="row" style={{ marginTop: 10 }}><button className="btn p" onClick={() => void save()} disabled={busy}>{busy ? "저장 중…" : "③ 저장 — 공개 화면에 반영(최대 10분)"}</button></div>
        </div>
      )}

      <h3 style={{ margin: "18px 0 8px" }}>입력한 식당 {rows.length}곳</h3>
      {rows.length === 0 && <div className="card"><p className="muted">아직 없어요. 위에서 식당을 찾아 첫 정보를 적어 보세요.</p></div>}
      {rows.map((r) => (
        <div key={r.kakaoId} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><b>{r.name}</b> <span className="muted">{r.address}</span></div>
            <div className="row"><button className="btn sm" onClick={() => edit(r)}>고치기</button><button className="btn sm d" onClick={() => void remove(r)}>지우기</button></div>
          </div>
          <div style={{ marginTop: 6 }}>
            {placeChips(r.info, null).map((c) => <span key={c.key} className={`tag ${c.tone === "yes" ? "g" : "m"}`} style={{ marginRight: 4 }}>{c.label}</span>)}
            <span className="muted">{verifiedLabel(r.info)}{r.updatedBy ? ` · ${r.updatedBy}` : ""}</span>
          </div>
          {placeNoteLine(r.info) && <div className="muted" style={{ marginTop: 4 }}>{placeNoteLine(r.info)}</div>}
          {(r.info.drinks.length > 0 || r.info.drinkNames.length > 0) && <div style={{ marginTop: 4 }}>술: {[...r.info.drinks.map((id) => dName.get(id) ?? id), ...r.info.drinkNames].join(" · ")}</div>}
          {(r.info.foods.length > 0 || r.info.menuNames.length > 0) && <div style={{ marginTop: 2 }}>메뉴: {[...r.info.foods.map((id) => fName.get(id) ?? id), ...r.info.menuNames].join(" · ")}</div>}
          {r.info.menuNote && <div style={{ marginTop: 2 }}>{r.info.menuNote}</div>}
          {(r.contactPhone || r.info.naverUrl || r.memo) && (
            <div className="muted" style={{ marginTop: 4 }}>
              {r.contactPhone && <span>대표 번호(운영자 전용) <a href={"tel:" + r.contactPhone}>{r.contactPhone}</a> </span>}
              {r.info.naverUrl && <span>· <a href={r.info.naverUrl} target="_blank" rel="noopener">네이버 지도 ↗</a> </span>}
              {r.memo && <span>· 메모: {r.memo}</span>}
            </div>
          )}
        </div>
      ))}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

/** 술·메뉴 목록 — 이름을 적고 "추가". 카탈로그에 있는 이름이면 id로 연결, 없으면 적은 이름 그대로(규칙: shared addListItem) */
function ListAdder({ label, placeholder, catalog, ids, names, nameOf, tone, onChange, say }: { label: string; placeholder: string; catalog: Item[]; ids: string[]; names: string[]; nameOf: Map<string, string>; tone: string; onChange: (ids: string[], names: string[]) => void; say: (m: string) => void }) {
  const [q, setQ] = useState("");
  const squeeze = (t: string) => t.split(" ").join("");
  const hits = useMemo(() => { const k = squeeze(q.trim()); return k ? catalog.filter((x) => squeeze(x.name).includes(k) && !ids.includes(x.id)).slice(0, 6) : []; }, [q, catalog, ids]);
  const add = (text: string) => {
    const r = addListItem({ ids, names }, text, catalog);
    if (!r.added) { say(text.trim() ? "이미 들어 있어요" : "이름을 적어 주세요"); return; }
    onChange(r.ids, r.names); setQ("");
  };
  return (
    <div>
      <label>{label} <span className="muted">{ids.length + names.length}개</span></label>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q); } }} placeholder={placeholder} maxLength={30} style={{ flex: 1, minWidth: 120 }} />
        <button type="button" className="btn" onClick={() => add(q)}>추가</button>
      </div>
      {hits.length > 0 && <div className="row" style={{ marginTop: 6 }}><span className="muted">페어링GO에 있는 이름:</span>{hits.map((x) => <button type="button" key={x.id} className="btn sm" onClick={() => add(x.name)}>+ {x.name}</button>)}</div>}
      {(ids.length > 0 || names.length > 0) && (
        <div className="row" style={{ marginTop: 6 }}>
          {ids.map((id) => <button type="button" key={id} className={"tag " + tone} style={{ border: 0, cursor: "pointer" }} title="페어링GO와 연결됨 — 누르면 빠집니다" onClick={() => onChange(ids.filter((x) => x !== id), names)}>{nameOf.get(id) ?? id} ×</button>)}
          {names.map((n) => <button type="button" key={n} className="tag m" style={{ border: 0, cursor: "pointer" }} title="직접 적은 이름 — 누르면 빠집니다" onClick={() => onChange(ids, names.filter((x) => x !== n))}>{n} ×</button>)}
        </div>
      )}
    </div>
  );
}
