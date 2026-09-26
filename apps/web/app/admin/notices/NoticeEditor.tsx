"use client";
import { useState } from "react";
import type { AdminNotice } from "@/lib/notifications";

type Draft = { id: number | null; kind: string; title: string; body: string; href: string; startsOn: string; endsOn: string; active: boolean };
const empty = (): Draft => ({ id: null, kind: "notice", title: "", body: "", href: "", startsOn: "", endsOn: "", active: true });
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export default function NoticeEditor({ rows, kinds }: { rows: AdminNotice[]; kinds: { id: string; label: string }[] }) {
  const [d, setD] = useState<Draft>(empty());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch("/admin/api/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { setMsg(j.error ?? "저장하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  async function remove(id: number) {
    if (!confirm("이 공지를 지울까요?")) return;
    setBusy(true);
    await fetch("/admin/api/notices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    location.reload();
  }
  async function toggle(row: AdminNotice) {
    setBusy(true);
    await fetch("/admin/api/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...row, active: !row.active }) });
    location.reload();
  }

  return (
    <>
      <div className="card">
        <b>{d.id ? `공지 #${d.id} 고치기` : "새 공지"}</b>
        <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
          <label style={{ width: 120 }}>종류<select value={d.kind} onChange={(e) => set({ kind: e.target.value })}>{kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
          <label style={{ flex: "1 1 260px" }}>제목<input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} placeholder="예: 추석 연휴 배송 안내" /></label>
        </div>
        <label style={{ display: "block", marginTop: 8 }}>본문 <span className="muted">(300자, 선택)</span><textarea value={d.body} onChange={(e) => set({ body: e.target.value })} maxLength={300} rows={2} style={{ width: "100%" }} /></label>
        <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 220px" }}>링크 <span className="muted">(/events 처럼 사이트 안 주소, 선택)</span><input value={d.href} onChange={(e) => set({ href: e.target.value })} placeholder="/events" /></label>
          <label style={{ width: 150 }}>시작일<input type="date" value={d.startsOn} onChange={(e) => set({ startsOn: e.target.value })} /></label>
          <label style={{ width: 150 }}>종료일<input type="date" value={d.endsOn} onChange={(e) => set({ endsOn: e.target.value })} /></label>
          <label className="row" style={{ gap: 6, alignSelf: "flex-end" }}><input type="checkbox" style={{ width: "auto" }} checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> 켜기</label>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <button className="btn p" disabled={busy || d.title.trim().length < 2} onClick={save}>{d.id ? "저장" : "올리기"}</button>
          {d.id && <button className="btn" disabled={busy} onClick={() => setD(empty())}>새 공지로</button>}
          {msg && <span className="muted">{msg}</span>}
        </div>
      </div>
      <div className="card">
        {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>아직 공지가 없어요.</p> : (
          <table className="t">
            <thead><tr><th>종류</th><th>제목</th><th>기간</th><th>올린 날</th><th>상태</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={r.active ? undefined : { opacity: .6 }}>
                  <td><span className="tag">{kinds.find((k) => k.id === r.kind)?.label ?? r.kind}</span></td>
                  <td><b>{r.title}</b>{r.body && <div className="muted small">{r.body}</div>}{r.href && <div className="small"><code>{r.href}</code></div>}</td>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>{r.startsOn || "…"} ~ {r.endsOn || "…"}</td>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>{kst(r.at)}</td>
                  <td>{r.active ? <span className="tag g">켜짐</span> : <span className="tag m">꺼짐</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm" disabled={busy} onClick={() => setD({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, startsOn: r.startsOn, endsOn: r.endsOn, active: r.active })}>고치기</button>{" "}
                    <button className="btn sm" disabled={busy} onClick={() => toggle(r)}>{r.active ? "끄기" : "켜기"}</button>{" "}
                    <button className="btn sm" disabled={busy} onClick={() => remove(r.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
