"use client";
import { useState } from "react";

export default function ReviewActions({ id, status }: { id: number; status: "active" | "hidden" }) {
  const [busy, setBusy] = useState(false);
  async function run(action: "hide" | "restore" | "delete") {
    const reason = action === "hide" ? window.prompt("숨김 사유(운영 기록)") ?? "" : "";
    if (action === "delete" && !confirm("이 리뷰를 지울까요? 사진도 함께 지워지고 되돌릴 수 없어요.")) return;
    setBusy(true);
    const r = await fetch("/admin/api/place-reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, reason }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "처리하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  return (
    <div className="row" style={{ gap: 6, marginTop: 10 }}>
      {status === "hidden" ? <button className="btn sm p" disabled={busy} onClick={() => run("restore")}>복구</button> : <button className="btn sm" disabled={busy} onClick={() => run("hide")}>숨김</button>}
      <button className="btn sm" disabled={busy} onClick={() => run("delete")}>삭제</button>
    </div>
  );
}
