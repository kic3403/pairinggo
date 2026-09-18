"use client";
import { useState } from "react";

export type ChangeView = { id: number; merchantName: string; who: string; section: string; summary: string; createdAt: string; revertedAt: string | null };
const SECTION: Record<string, string> = { info: "매장 정보", hours: "영업시간", closures: "임시 휴무", settings: "예약 설정" };

/** 최근 변경 — 파트너 수정은 바로 반영되고, 운영자는 여기서 보고 되돌린다 */
export default function ChangeLog({ rows }: { rows: ChangeView[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  async function revert(id: number) {
    if (!confirm("이 변경 직전 값으로 되돌릴까요? 되돌림도 이력에 남아요.")) return;
    setBusy(id);
    const r = await fetch("/admin/api/partners/changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "되돌리지 못했어요"); setBusy(null); return; }
    location.reload();
  }
  if (!rows.length) return <div className="card muted">아직 변경이 없어요.</div>;
  return (
    <div className="card" style={{ padding: 0 }}>
      {rows.map((c, i) => (
        <div key={c.id} className="row" style={{ padding: "10px 14px", borderTop: i ? "1px solid var(--line, #e5e3de)" : undefined, gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", minWidth: 118 }}>{c.createdAt.slice(0, 16).replace("T", " ")}</span>
          <b style={{ fontSize: 14 }}>{c.merchantName}</b>
          <span className="tag">{SECTION[c.section] ?? c.section}</span>
          <span style={{ fontSize: 13, flex: "1 1 220px" }}>{c.summary} <span className="muted">· {c.who}</span></span>
          {c.revertedAt ? <span className="muted" style={{ fontSize: 12.5 }}>되돌림</span> : c.who === "운영자" ? null : (
            <button className="btn sm" disabled={busy !== null} onClick={() => revert(c.id)}>{busy === c.id ? "되돌리는 중…" : "되돌리기"}</button>
          )}
        </div>
      ))}
    </div>
  );
}
