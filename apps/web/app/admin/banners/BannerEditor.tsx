"use client";
/** 홈 배너 편집(어드민) — 목록 + 한 장 편집 폼. 저장은 /admin/api/banners(POST), 삭제는 DELETE ?id= */
import { useState } from "react";
import { BANNER_KINDS, BANNER_KIND_LABEL, BANNER_TONES, BANNER_TONE_LABEL, PARTNER_KIND_LABEL, type BannerRow, type PartnerKind } from "@pairinggo/shared/home";

type Partner = { id: string; name: string; kind: PartnerKind; photo: string | null };
type Draft = Omit<BannerRow, "id"> & { id?: string };
const empty = (): Draft => ({ kind: "event", title: "", subtitle: "", badge: "", cta: "보기", href: "/hot", tone: "navy", imageUrl: null, merchantId: null, startsOn: null, endsOn: null, sort: 0, active: true });

export default function BannerEditor({ rows, partners, today }: { rows: BannerRow[]; partners: Partner[]; today: string }) {
  const [d, setD] = useState<Draft>(empty());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const live = (r: BannerRow) => r.active && (!r.startsOn || r.startsOn <= today) && (!r.endsOn || r.endsOn >= today);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/admin/api/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "저장 실패");
      setMsg("저장했어요 — 홈에 바로 반영됩니다"); setTimeout(() => location.reload(), 700);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!confirm("이 배너를 지울까요?")) return;
    const r = await fetch(`/admin/api/banners?id=${id}`, { method: "DELETE" });
    if (r.ok) location.reload(); else setMsg("삭제 실패");
  };
  const pick = (r: BannerRow) => { setD({ ...r }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>{d.id ? `배너 수정 #${d.id}` : "새 배너"}</b>
        <div className="row">
          {BANNER_KINDS.filter((k) => k !== "report").map((k) => <label key={k} className="row" style={{ gap: 4 }}><input type="radio" name="kind" style={{ width: "auto" }} checked={d.kind === k} onChange={() => set({ kind: k })} />{BANNER_KIND_LABEL[k]}</label>)}
        </div>
        {d.kind === "partner" && (
          <label>파트너 매장<select value={d.merchantId ?? ""} onChange={(e) => { const p = partners.find((x) => x.id === e.target.value); set({ merchantId: e.target.value || null, imageUrl: d.imageUrl || p?.photo || null }); }}>
            <option value="">(고르기)</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name} · {PARTNER_KIND_LABEL[p.kind]}{p.photo ? " · 사진 있음" : ""}</option>)}</select>
            <span className="muted">제목·부제·버튼 문구를 비우면 매장 이름과 업종에 맞는 문구가 자동으로 들어갑니다</span></label>
        )}
        <div className="row">
          <label style={{ flex: 1, minWidth: 220 }}>제목{d.kind !== "partner" && "*"}<input value={d.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} placeholder={d.kind === "partner" ? "(비우면 매장 이름)" : "추석엔 전통주 한 병"} /></label>
          <label style={{ width: 140 }}>배지<input value={d.badge} maxLength={12} onChange={(e) => set({ badge: e.target.value })} placeholder="추석 특집" /></label>
          <label style={{ width: 120 }}>버튼 문구<input value={d.cta} maxLength={12} onChange={(e) => set({ cta: e.target.value })} /></label>
        </div>
        <label>부제<input value={d.subtitle} maxLength={80} onChange={(e) => set({ subtitle: e.target.value })} placeholder="한 줄 설명" /></label>
        <div className="row">
          <label style={{ flex: 1, minWidth: 220 }}>링크{d.kind !== "partner" && "*"} <span className="muted">사이트 안 주소</span><input value={d.href} onChange={(e) => set({ href: e.target.value })} placeholder="/hot · /drinks?kind=trad&cat=makgeolli · /awards?c=fair" /></label>
          <label style={{ width: 130 }}>색<select value={d.tone} onChange={(e) => set({ tone: e.target.value as Draft["tone"] })}>{BANNER_TONES.map((t) => <option key={t} value={t}>{BANNER_TONE_LABEL[t]}</option>)}</select></label>
        </div>
        <label>사진 주소 <span className="muted">우리 저장소(supabase.co/storage/…/public/…)만</span><input value={d.imageUrl ?? ""} onChange={(e) => set({ imageUrl: e.target.value || null })} placeholder="https://….supabase.co/storage/v1/object/public/menu-photos/…" /></label>
        <div className="row">
          <label style={{ width: 160 }}>시작일<input type="date" value={d.startsOn ?? ""} onChange={(e) => set({ startsOn: e.target.value || null })} /></label>
          <label style={{ width: 160 }}>종료일<input type="date" value={d.endsOn ?? ""} onChange={(e) => set({ endsOn: e.target.value || null })} /></label>
          <label style={{ width: 90 }}>순서<input type="number" value={d.sort} onChange={(e) => set({ sort: Number(e.target.value) || 0 })} /></label>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" style={{ width: "auto" }} checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> 켜기</label>
        </div>
        <div className="row">
          <button type="button" className="btn p" onClick={save} disabled={busy}>{busy ? "저장 중…" : d.id ? "수정 저장" : "배너 추가"}</button>
          {d.id && <button type="button" className="btn" onClick={() => setD(empty())}>새로 만들기</button>}
          {msg && <span className="muted">{msg}</span>}
        </div>
      </div>

      <div className="card">
        <table className="t">
          <thead><tr><th>상태</th><th>종류</th><th>제목</th><th>기간</th><th>순서</th><th>링크</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{live(r) ? <span className="tag m">노출 중</span> : r.active ? <span className="tag w">기간 밖</span> : <span className="muted">꺼짐</span>}</td>
                <td>{BANNER_KIND_LABEL[r.kind]}</td>
                <td>{r.title || (r.kind === "partner" ? `(${partners.find((p) => p.id === r.merchantId)?.name ?? "매장 없음"})` : "")}{r.badge && <span className="muted"> · {r.badge}</span>}</td>
                <td>{r.startsOn ?? "…"} ~ {r.endsOn ?? "…"}</td>
                <td style={{ textAlign: "right" }}>{r.sort}</td>
                <td><code>{r.href || "(매장)"}</code></td>
                <td className="row"><button type="button" className="btn sm" onClick={() => pick(r)}>편집</button><button type="button" className="btn sm d" onClick={() => remove(r.id)}>삭제</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">아직 배너가 없습니다 — 위에서 추가하세요. 홈에는 리포트·상시 카드가 보이고 있습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
