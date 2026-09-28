"use client";
/** 어드민 — 파트너가 올린 추천 페어링(2026-09-29). 허위·과장 추천은 운영자가 지운다(근거·올린 등급도 함께 되돌림) */
import { useState } from "react";

type Row = { id: number; drinkText: string; foodText: string; note: string; linked: boolean };

export default function PartnerPairingList({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (!rows.length) return null;
  async function remove(r: Row) {
    if (!confirm(`${r.drinkText} × ${r.foodText} 추천을 지울까요? 손님 화면의 근거도 함께 빠져요.`)) return;
    setBusy(true);
    const res = await fetch("/admin/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pairing-remove", pairingId: r.id }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) alert(j.error ?? "지우지 못했어요"); else setRows((x) => x.filter((y) => y.id !== r.id));
    setBusy(false);
  }
  return (
    <details style={{ marginTop: 8 }}>
      <summary className="muted" style={{ cursor: "pointer" }}>추천 페어링 {rows.length}개</summary>
      <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: 4 }}>
        {rows.map((r) => (
          <li key={r.id} className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
            <span><b>{r.drinkText} × {r.foodText}</b>{r.note ? <span className="muted"> — {r.note}</span> : null} <span className={`tag${r.linked ? " g" : " m"}`}>{r.linked ? "카드 근거" : "글자만"}</span></span>
            <button className="btn sm" disabled={busy} onClick={() => remove(r)}>지우기</button>
          </li>
        ))}
      </ul>
    </details>
  );
}
