"use client";
import { useState } from "react";

type Status = "applied" | "approved" | "rejected" | "suspended";
const ACTIONS: Record<Status, { action: string; label: string; reason?: boolean }[]> = {
  applied: [{ action: "approve", label: "승인" }, { action: "reject", label: "반려", reason: true }],
  approved: [{ action: "suspend", label: "정지", reason: true }],
  suspended: [{ action: "resume", label: "재개" }],
  rejected: [{ action: "approve", label: "다시 승인" }],
};

export default function PartnerActions({ id, status }: { id: string; status: Status }) {
  const [busy, setBusy] = useState(false);
  async function run(action: string, needsReason?: boolean) {
    const reason = needsReason ? window.prompt("사유(사장님 화면에 보여요)") : "";
    if (needsReason && !reason?.trim()) return;
    setBusy(true);
    const r = await fetch("/admin/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, reason }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "처리하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  return (
    <div className="row" style={{ gap: 6, marginTop: 10 }}>
      {ACTIONS[status].map((a) => (
        <button key={a.action} className={`btn sm${a.action === "approve" || a.action === "resume" ? " p" : ""}`} disabled={busy} onClick={() => run(a.action, a.reason)}>{a.label}</button>
      ))}
    </div>
  );
}
