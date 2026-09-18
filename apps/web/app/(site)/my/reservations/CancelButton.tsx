"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";

export default function CancelButton({ id, store }: { id: string; store: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function cancel() {
    if (!confirm(`${store} 예약을 취소할까요?`)) return;
    setBusy(true); setErr("");
    const r = await fetch(`/api/reservations/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (r?.ok) { track("reserve_cancel", { place: store }); router.refresh(); return; }
    setBusy(false); setErr(j?.error ?? "취소하지 못했어요");
  }
  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="btn sm" disabled={busy} onClick={cancel}>{busy ? "취소하는 중…" : "예약 취소"}</button>
      {err ? <p className="form-error" role="alert">{err}</p> : null}
    </div>
  );
}
