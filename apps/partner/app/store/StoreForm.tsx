"use client";
/**
 * 정보 탭(2026-10-02 정리) — 양조장은 "양조장 정보", 식당·리쿼샵은 "매장 정보". 여기에는 **정보와 대표 사진만** 둔다:
 * 대표 번호 · (양조장) 우리 양조장 · 한 줄 소개 · 대표 사진 · 편의 정보 · 네이버 지도 링크.
 * 파는 것(메뉴·술 표)은 판매 탭(`sell/MenuForm.tsx`)으로 옮겼다 — 정보 화면과 판매 화면이 겹쳐 보인다는 사용자 요청.
 * 저장은 `part: "info"`로 보내 판매 탭의 표는 건드리지 않는다(shared storePartInput).
 */
import Link from "next/link";
import { useState } from "react";
import { PARTNER_INTRO_EXAMPLE, PARTNER_PLACE_LABEL, STORE_PHOTOS_MAX, cleanNaverUrl, formatPrice, placeChips, type PartnerKind, type PlaceInfo } from "@pairinggo/shared";
import { shrinkToJpeg } from "@pairinggo/shared/image-client";

const PARKING = [["", "모름"], ["free", "무료 주차"], ["paid", "유료 주차"], ["valet", "발레 파킹"], ["street", "근처 노상·공영"], ["none", "주차 불가"]] as const;
const TRI = [["", "모름"], ["yes", "가능"], ["no", "불가"]] as const;
const STORE_PHOTO_EDGE = 1280;

/**
 * 대표 사진(최대 10장) — 페어링GO 매장 상세 맨 위에 이 순서대로 보인다(첫 장이 대표). ‹ › 로 순서 바꾸기, × 빼기.
 * 메뉴 사진과 같은 저장소·같은 올리기 경로(/api/menu-photo), 긴 변 1,280px. [저장]을 눌러야 반영된다.
 */
function StorePhotos({ photos, onChange }: { photos: string[]; onChange: (f: (p: string[]) => string[]) => void }) {
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  async function add(files: FileList | null) {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, STORE_PHOTOS_MAX - photos.length - busy);
    if (!list.length) { if (files?.length) setErr(`대표 사진은 ${STORE_PHOTOS_MAX}장까지예요`); return; }
    setErr(""); setBusy((n) => n + list.length);
    for (const f of list) {
      try {
        const { data } = await shrinkToJpeg(f, STORE_PHOTO_EDGE);
        const r = await fetch("/api/menu-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
        const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!r.ok || !j.url) throw new Error(j.error ?? "사진을 올리지 못했어요");
        onChange((p) => (p.length < STORE_PHOTOS_MAX ? [...p, j.url!] : p));
      } catch (e) { setErr((e as Error).message); } finally { setBusy((n) => n - 1); }
    }
  }
  const move = (i: number, d: number) => onChange((p) => { const q = [...p]; const j = i + d; if (j < 0 || j >= q.length) return p; [q[i], q[j]] = [q[j], q[i]]; return q; });
  return (
    <div className="sphotos">
      {photos.map((u, i) => (
        <figure key={u} className="sph">
          <img src={u} alt={`대표 사진 ${i + 1}`} />
          {i === 0 ? <figcaption>대표</figcaption> : null}
          <div className="sph-bar">
            <button type="button" aria-label="앞으로" disabled={i === 0} onClick={() => move(i, -1)}>‹</button>
            <button type="button" aria-label="뒤로" disabled={i === photos.length - 1} onClick={() => move(i, 1)}>›</button>
            <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => onChange((p) => p.filter((x) => x !== u))}>×</button>
          </div>
        </figure>
      ))}
      {photos.length + busy < STORE_PHOTOS_MAX ? (
        <label className="sph add">
          <span>{busy ? `올리는 중… (${busy})` : `+ 사진 추가\n${photos.length}/${STORE_PHOTOS_MAX}`}</span>
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      ) : null}
      {err ? <p className="err" role="alert" style={{ margin: 0, gridColumn: "1 / -1" }}>{err}</p> : null}
    </div>
  );
}
/** 업종별 화면 이름 — 탭·제목과 같은 말(_bar.tsx infoTabLabel) */
const SELL_WHAT: Record<PartnerKind, string> = { restaurant: "메뉴판(음식·술)", brewery: "판매하는 술", liquor: "취급하는 술" };

export function StoreForm({ phone: phone0, info, siteUrl, kakaoId, kind = "restaurant", brewery: brewery0 = "", breweries = [] }: { phone: string; info: PlaceInfo | null; siteUrl: string; kakaoId: string; kind?: PartnerKind; brewery?: string; breweries?: string[] }) {
  const [phone, setPhone] = useState(phone0);
  const [brewery, setBrewery] = useState(brewery0);   // 양조장 파트너가 고른 카탈로그 양조장(0031)
  const [f, setF] = useState({
    menuNote: info?.menuNote ?? "", parking: info?.parking ?? "", parkingNote: info?.parkingNote ?? "",
    corkage: info?.corkage ?? "", corkageNote: info?.corkageNote ?? "", room: info?.room ?? "", roomNote: info?.roomNote ?? "", naverUrl: info?.naverUrl ?? "",
  });
  // 양조장·리쿼샵은 콜키지·룸을 쓰지 않는다
  const drinkOnly = kind !== "restaurant";
  const placeLabel = PARTNER_PLACE_LABEL[kind];   // 화면에서 "페어링GO 양조장 목록"처럼 부른다(2026-09-22)
  const [photos, setPhotos] = useState<string[]>(() => info?.photos ?? []);
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  /** 양조장·리쿼샵은 콜키지·룸을 쓰지 않는다 — 화면에서 숨기고 저장에서도 비운다(2026-09-21) */
  const amenities = drinkOnly ? { ...f, corkage: "", corkageNote: "", room: "", roomNote: "" } : f;
  const menuItems = info?.menuItems ?? [], drinkItems = info?.drinkItems ?? [];

  const preview: PlaceInfo = {
    ...amenities, parking: (amenities.parking || null) as PlaceInfo["parking"], corkage: (amenities.corkage || null) as PlaceInfo["corkage"], room: (amenities.room || null) as PlaceInfo["room"],
    drinks: [], drinkNames: [], foods: [], menuNames: [], menuItems, drinkItems, naverUrl: cleanNaverUrl(f.naverUrl), source: "partner", verifiedAt: null,
  };
  const chips = placeChips(preview, null);

  async function save() {
    if (f.naverUrl.trim() && !cleanNaverUrl(f.naverUrl)) { setState({ err: "네이버 지도 링크는 https://naver.me/… 또는 https://map.naver.com/… 모양만 받아요" }); return; }
    setState({ busy: true });
    const r = await fetch("/api/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ part: "info", phone, brewery, info: { ...amenities, photos } }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setState(r?.ok ? { ok: `저장했어요 — 페어링GO ${placeLabel} 목록과 예약 화면에 바로 반영돼요(목록 캐시로 최대 10분)` } : { err: j?.error ?? "저장하지 못했어요" });
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <label className="f">{kind === "brewery" ? "양조장 대표 번호" : "매장 대표 번호"} <span className="hint">손님 예약 화면·확정 안내에 보여요</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="042-000-0000" maxLength={20} />
        </label>
        {kind !== "restaurant" ? (
          <label className="f">우리 양조장 <span className="hint">고르면 그 양조장의 전통주가 {placeLabel} 화면에 보이고, 술 화면에서 방문 예약으로 이어져요</span>
            <input type="text" list="brewery-list" value={brewery} onChange={(e) => setBrewery(e.target.value)} placeholder="예: 한증류소" maxLength={60} />
            <datalist id="brewery-list">{breweries.map((b) => <option key={b} value={b} />)}</datalist>
          </label>
        ) : null}
        <label className="f">한 줄 소개 <span className="hint">120자 — 페어링GO {placeLabel} 카드에 그대로 보여요</span>
          <textarea value={f.menuNote} onChange={set("menuNote")} maxLength={120} placeholder={PARTNER_INTRO_EXAMPLE[kind]} />
        </label>
      </section>

      <section className="panel stack">
        <div>
          <h2 style={{ margin: 0 }}>대표 사진 <span className="muted small">{photos.length}/{STORE_PHOTOS_MAX}</span></h2>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            페어링GO {placeLabel} 상세 맨 위에 이 순서대로 보여요(첫 장이 대표). {kind === "brewery" ? "양조장 전경·빚는 모습·시음 공간" : kind === "liquor" ? "매장 외관·진열대" : "매장 외관·내부·대표 메뉴"} 사진을 올려 주세요 — 직접 찍었거나 쓸 권리가 있는 사진만.
          </p>
        </div>
        <StorePhotos photos={photos} onChange={setPhotos} />
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>편의 정보</h2>
        {([["parking", "주차", PARKING, "parkingNote", "예: 건물 뒤 5대"], ["corkage", "콜키지(술 가져오기)", TRI, "corkageNote", "예: 병당 1만원, 전통주 무료"], ["room", "룸", TRI, "roomNote", "예: 8인 룸 1개"]] as const)
          .filter(([k]) => !drinkOnly || k === "parking")
          .map(([k, label, opts, nk, ph]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 8, alignItems: "end" }}>
            <label className="f">{label}
              <select value={f[k]} onChange={set(k)}>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </label>
            <label className="f"><span className="hint">{k === "corkage" ? "병당 금액 — 적으면 페어링GO가 싼 곳부터 먼저 보여 줘요" : "덧붙일 말(40자)"}</span><input type="text" value={f[nk]} onChange={set(nk)} maxLength={40} placeholder={ph} /></label>
          </div>
        ))}
        <label className="f">네이버 지도 링크 <span className="hint">선택 — 손님이 누르면 네이버 지도로 가요</span>
          <input type="text" value={f.naverUrl} onChange={set("naverUrl")} placeholder="https://naver.me/…" inputMode="url" />
        </label>
      </section>

      {/* 파는 것은 판매 탭에서 — 지금 적어 둔 개수만 보여 주고 그쪽으로 잇는다 */}
      <section className="panel">
        <p style={{ margin: 0 }}>
          <b>{SELL_WHAT[kind]}</b>은 <Link href="/sell"><b>판매</b></Link> 탭에서 적어요.
          <span className="muted small"> 지금 {kind === "restaurant" ? `메뉴 ${menuItems.length}개 · 술 ${drinkItems.length}개` : `술 ${drinkItems.length}개`}</span>
        </p>
      </section>

      <section className="panel">
        <p className="small muted" style={{ marginBottom: 8 }}>페어링GO {placeLabel} 카드에 이렇게 보여요</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips.length ? chips.map((c) => <span key={c.key} className={`chip${c.tone === "no" ? " mute" : ""}`}>{c.label}</span>) : <span className="muted small">편의 정보를 고르면 칩이 생겨요</span>}
        </div>
        {menuItems.some((m) => m.price != null) ? <p className="small" style={{ margin: "8px 0 0" }}>메뉴 예: {menuItems.filter((m) => m.name).slice(0, 3).map((m) => `${m.name}${m.price != null ? ` ${formatPrice(m.price)}` : ""}`).join(" · ")}</p> : null}
        <p className="small" style={{ margin: "8px 0 0" }}><a href={`${siteUrl}/`} target="_blank" rel="noreferrer">페어링GO 열기 ↗</a> <span className="muted">· 매장 id {kakaoId}</span></p>
      </section>

      {state.err ? <p className="err" role="alert">{state.err}</p> : null}
      {state.ok ? <p className="okmsg" role="status">{state.ok}</p> : null}
      <button className="btn primary block" disabled={state.busy} onClick={save}>{state.busy ? "저장하는 중…" : "저장"}</button>
    </div>
  );
}
