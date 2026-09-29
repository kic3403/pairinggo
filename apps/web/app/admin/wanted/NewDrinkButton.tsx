"use client";
/**
 * 없는 술을 그 자리에서 카탈로그에 넣기(2026-09-29 사용자 요청 — 카탈로그에 없어서 온 요청인데 카탈로그에서 고르게 하던 것을 바꿈).
 * 이름은 요청에서 채우고 종류·도수·양조장·지역·설명·맛 프로필(같은 종류 평균으로 채워 둠)·판매처를 적는다.
 * 판매처는 운영자가 찾아 넣는다(찾아보기 링크) — 스마트스토어가 아니면 서버가 첫 화면에 술 이름이 보이는지 확인한다.
 */
import { useState } from "react";
import { NEW_DRINK_CATEGORIES, PROFILE_KEYS, PROFILE_LABEL, buySearchLinks, type DrinkProfile } from "@pairinggo/shared";

type Props = { name: string; requestId?: number; avg: Record<string, DrinkProfile>; label?: string };

export default function NewDrinkButton({ name: initial, requestId, avg, label = "새 술로 등록" }: Props) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: initial, category: "", abv: "", brewery: "", region: "", desc: "", buyUrl: "", buyStore: "" });
  // 맛 축 값 — null = 모름(양조장마다 밝히는 맛 항목이 달라서, 2026-09-29 사용자 요청)
  const [profile, setProfile] = useState<Record<keyof DrinkProfile, number | null>>({ sweet: 3, acid: 3, body: 3, fizz: 3, aroma: 3 });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  function pickCategory(c: string) {
    setF((x) => ({ ...x, category: c }));
    if (!touched && avg[c]) setProfile({ ...avg[c] }); // 손대지 않았으면 같은 종류 평균으로
  }
  async function save(force = false): Promise<void> {
    setBusy(true); setMsg("");
    const r = await fetch("/admin/api/drinks/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, profile, force, requestId }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; id?: string; name?: string; pairings?: number };
    setBusy(false);
    if (!r.ok) {
      const err = j.error ?? "저장하지 못했어요";
      if (!force && err.includes("그래도 저장") && confirm(`${err}\n\n이 주소 그대로 저장할까요?`)) return save(true);
      setMsg(err); return;
    }
    alert(`${j.name}(${j.id})을 카탈로그에 넣고 발행했어요 — 맛 분석 추정 페어링 ${j.pairings}개${requestId ? " · 요청한 회원에게 '등록됨'으로 알렸어요" : ""}.\n사이트 반영은 최대 10분.`);
    location.reload();
  }
  if (!open) return <button className="btn sm p" onClick={() => setOpen(true)}>{label}</button>;
  const links = buySearchLinks(f.name.trim() || initial);
  return (
    <div className="nd-back" role="dialog" aria-modal="true" aria-label="새 술 등록" onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
      <div className="nd-box">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>새 술 등록</h3>
          <button className="btn sm" disabled={busy} onClick={() => setOpen(false)}>닫기</button>
        </div>
        <p className="muted small" style={{ margin: "4px 0 12px" }}>카탈로그에 바로 넣고 발행합니다. 페어링은 맛 프로필로 추정한 8개가 붙고, 근거는 나중에 근거 검수에서 붙여요.</p>
        <div className="nd-grid">
          <div className="span2"><label>술 이름 *</label><input value={f.name} onChange={set("name")} maxLength={40} /></div>
          <div><label>종류 *</label>
            <select value={f.category} onChange={(e) => pickCategory(e.target.value)}>
              <option value="">고르기</option>
              {NEW_DRINK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label>도수(%)</label><input value={f.abv} onChange={set("abv")} inputMode="decimal" placeholder="모르면 비워 두기" /></div>
          <div><label>양조장</label><input value={f.brewery} onChange={set("brewery")} maxLength={40} /></div>
          <div><label>지역</label><input value={f.region} onChange={set("region")} maxLength={30} placeholder="예: 충남 서천" /></div>
          <div className="span2"><label>설명(사실만 — 남의 글을 그대로 옮기지 않기)</label><textarea value={f.desc} onChange={set("desc")} maxLength={300} rows={3} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label style={{ margin: 0 }}>맛 프로필(1~5 · 모름){f.category && !touched ? ` — ${f.category} 평균으로 채움` : ""}</label>
            <button type="button" className="linkish small" onClick={() => { setTouched(true); setProfile({ sweet: null, acid: null, body: null, fizz: null, aroma: null }); }}>모두 모름</button>
          </div>
          <div className="nd-prof" style={{ marginTop: 4 }}>
            {PROFILE_KEYS.map((k) => (
              <div key={k}><span>{PROFILE_LABEL[k]}</span>
                <select value={profile[k] ?? ""} onChange={(e) => { setTouched(true); setProfile((p) => ({ ...p, [k]: e.target.value === "" ? null : Number(e.target.value) })); }}>
                  <option value="">모름</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ margin: "4px 0 0" }}>양조장이 밝히지 않은 항목은 <b>모름</b> — 사이트에는 &lsquo;모름&rsquo;으로 보이고, 페어링 추천 계산에만 같은 종류 평균을 씁니다.</p>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>판매처(선택) — 찾아보기: {links.map((l, i) => <span key={l.label}>{i > 0 && " · "}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>)}</label>
          <div className="nd-grid">
            <div className="span2"><input value={f.buyUrl} onChange={set("buyUrl")} placeholder="https:// 상품 페이지 주소 (modoo.at 안 됨)" /></div>
            <div className="span2"><input value={f.buyStore} onChange={set("buyStore")} maxLength={30} placeholder="판매처 이름 (예: 양조장 공식몰, 키햐) — 비우면 자동" /></div>
          </div>
          <p className="muted small" style={{ margin: "4px 0 0" }}>스마트스토어가 아닌 주소는 첫 화면에 이 술 이름이 보여야 저장돼요. 판매처를 못 찾으면 비워 두세요 — 사이트는 네이버 쇼핑 검색으로 이어 줍니다.</p>
        </div>
        {msg && <p style={{ color: "var(--food-ink)", fontSize: 13, margin: "10px 0 0" }}>{msg}</p>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn p" disabled={busy || f.name.trim().length < 2 || !f.category} onClick={() => save()}>{busy ? "넣는 중…" : "카탈로그에 넣고 발행"}</button>
        </div>
      </div>
    </div>
  );
}
