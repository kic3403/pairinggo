"use client";
/** 주문 취소 — 발송 전까지(docs/22 §7) */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";

export default function CancelOrder({ orderNo }: { orderNo: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function cancel() {
    if (!confirm("주문을 취소할까요? 취소하면 되돌릴 수 없어요.")) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNo, reason: "손님 취소" }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined; setErr(j?.error ?? "취소하지 못했어요"); return; }
    track("order_cancel", { orderNo });
    router.refresh();
  }

  return (
    <div className="btns" style={{ marginTop: 12 }}>
      <button className="btn" onClick={cancel} disabled={busy}>{busy ? "취소 중…" : "주문 취소"}</button>
      {err ? <span className="small bad">{err}</span> : null}
    </div>
  );
}
