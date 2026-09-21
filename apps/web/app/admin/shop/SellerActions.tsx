"use client";
/** 입점 승인·정지·수수료율(docs/22 §3) */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerActions({ id, status, feeRate, hasLicense }: { id: string; status: string; feeRate: number; hasLicense: boolean }) {
  const [rate, setRate] = useState(String(feeRate));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function act(next: "approved" | "suspended") {
    if (next === "approved" && !hasLicense) { setErr("주류 통신판매 승인 번호가 없어요 — 양조장에 요청해 주세요"); return; }
    if (!confirm(next === "approved" ? "판매를 열까요? 상품이 손님 화면에 보입니다." : "판매를 정지할까요? 상품이 모두 내려갑니다.")) return;
    setBusy(true); setErr("");
    const r = await fetch("/admin/api/shop", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next, feeRate: Number(rate) || 0 }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined; setErr(j?.error ?? "바꾸지 못했어요"); return; }
    router.refresh();
  }

  return (
    <div className="row" style={{ marginTop: 8, gap: 8, display: "flex", flexWrap: "wrap", alignItems: "center" }}>
      <label className="small">앱 수수료 %
        <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" style={{ width: 64, marginLeft: 6 }} />
      </label>
      {status !== "approved" ? <button className="btn sm p" onClick={() => act("approved")} disabled={busy}>판매 열기</button> : null}
      {status === "approved" ? <button className="btn sm" onClick={() => act("suspended")} disabled={busy}>정지</button> : null}
      {err ? <span className="small bad">{err}</span> : null}
    </div>
  );
}
