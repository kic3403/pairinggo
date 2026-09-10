"use client";
import { useState } from "react";

export default function PublishButton() {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!confirm("지금 발행할까요? 앱 사용자에게 새 카탈로그가 전달됩니다.")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/admin/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      const j = await r.json();
      setMsg(r.ok ? `발행 완료 — 버전 ${j.version} · 술 ${j.counts.drinks} · 음식 ${j.counts.foods} · 페어링 ${j.counts.pairings}` : `실패: ${j.error}`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 10 }}>
      <label>발행 메모 (선택)</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예) 파일럿 후보 12건 승격" />
      <button className="btn p" style={{ marginTop: 8 }} onClick={go} disabled={busy}>{busy ? "발행 중…" : "발행하기"}</button>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
