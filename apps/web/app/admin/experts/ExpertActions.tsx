"use client";
import { useState } from "react";
import type { ExpertStatus } from "@pairinggo/shared";

const ACTIONS: Record<ExpertStatus, { action: string; label: string; reason?: boolean; name?: boolean }[]> = {
  applied: [{ action: "approve", label: "승인", name: true }, { action: "reject", label: "반려", reason: true }],
  approved: [{ action: "approve", label: "표시명 바꾸기", name: true }, { action: "suspend", label: "정지", reason: true }],
  suspended: [{ action: "resume", label: "재개" }],
  rejected: [{ action: "approve", label: "다시 승인", name: true }],
};

export default function ExpertActions({ userId, status, displayName }: { userId: string; status: ExpertStatus; displayName: string }) {
  const [busy, setBusy] = useState(false);
  async function run(action: string, needsReason?: boolean, askName?: boolean) {
    const reason = needsReason ? window.prompt("사유(회원 알림에 보여요)") : "";
    if (needsReason && !reason?.trim()) return;
    const name = askName ? window.prompt("카드 표시명(실명 · 소속 / 실명 직함)", displayName) : "";
    if (askName && !name?.trim()) return;
    setBusy(true);
    const r = await fetch("/admin/api/experts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action: status === "approved" && action === "approve" ? "rename" : action, reason, displayName: name }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "처리하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  return (
    <div className="row" style={{ gap: 6, marginTop: 10 }}>
      {ACTIONS[status].map((a) => (
        <button key={a.action + a.label} className={`btn sm${a.action === "approve" || a.action === "resume" ? " p" : ""}`} disabled={busy} onClick={() => run(a.action, a.reason, a.name)}>{a.label}</button>
      ))}
    </div>
  );
}
