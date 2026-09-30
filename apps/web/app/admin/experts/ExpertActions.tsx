"use client";
import { useState } from "react";
import { EXPERT_TIERS, EXPERT_TIER_LABEL, type ExpertStatus } from "@pairinggo/shared";

const ACTIONS: Record<ExpertStatus, { action: string; label: string; reason?: boolean; name?: boolean }[]> = {
  applied: [{ action: "approve", label: "승인", name: true }, { action: "reject", label: "반려", reason: true }],
  approved: [{ action: "approve", label: "표시명 바꾸기", name: true }, { action: "suspend", label: "정지", reason: true }],
  suspended: [{ action: "resume", label: "재개" }],
  rejected: [{ action: "approve", label: "다시 승인", name: true }],
};

export default function ExpertActions({ userId, status, displayName, tier = 1 }: { userId: string; status: ExpertStatus; displayName: string; tier?: number }) {
  const [busy, setBusy] = useState(false);
  const [curTier, setCurTier] = useState(tier);
  // 전문가 3단계 배지(2026-09-30) — 운영자가 정한다. 화면에는 배지 1~3개로
  async function changeTier(next: number) {
    setBusy(true);
    const r = await fetch("/admin/api/experts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action: "tier", tier: next }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) alert(j.error ?? "바꾸지 못했어요"); else setCurTier(next);
    setBusy(false);
  }
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
      {status === "approved" && (
        <label className="row" style={{ gap: 6, marginRight: 4 }}>
          <span className="muted small">배지</span>
          <select value={curTier} disabled={busy} onChange={(e) => changeTier(Number(e.target.value))} style={{ width: "auto", padding: "4px 8px" }}>
            {EXPERT_TIERS.map((t) => <option key={t} value={t}>{"✓".repeat(t)} {EXPERT_TIER_LABEL[t]}</option>)}
          </select>
        </label>
      )}
      {ACTIONS[status].map((a) => (
        <button key={a.action + a.label} className={`btn sm${a.action === "approve" || a.action === "resume" ? " p" : ""}`} disabled={busy} onClick={() => run(a.action, a.reason, a.name)}>{a.label}</button>
      ))}
    </div>
  );
}
