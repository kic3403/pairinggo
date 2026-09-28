"use client";
/** 사업자등록증(2026-09-29 필수) — 이미 가입한 매장이 올리거나 바꾸는 칸. 운영자만 보고 공개하지 않는다 */
import { useState } from "react";
import { shrinkToJpeg } from "@pairinggo/shared/image-client";

export function BizDocUpload({ count, at }: { count: number; at: string | null }) {
  const [state, setState] = useState({ count, at });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function upload(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/")).slice(0, 2);
    if (!files.length) return;
    setBusy(true); setMsg(null);
    try {
      const images = await Promise.all(files.map((f) => shrinkToJpeg(f, 1600)));
      const r = await fetch("/api/biz-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
      const j = (await r.json().catch(() => ({}))) as { count?: number; error?: string };
      if (!r.ok) throw new Error(j.error || "올리지 못했어요");
      setState({ count: j.count ?? images.length, at: new Date().toISOString() });
      setMsg({ ok: true, text: "사업자등록증을 올렸어요 — 운영자가 확인해요." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  }
  return (
    <section className="panel" style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 17 }}>사업자등록증 <span className="hint">(필수 · 운영자만 봐요)</span></h2>
      {state.count > 0
        ? <p className="small muted" style={{ margin: "6px 0 0" }}>등록됨 {state.count}장{state.at ? ` · ${new Date(state.at).toLocaleDateString("ko-KR")}` : ""} — 바뀌었으면 새로 올려 주세요.</p>
        : <p className="err" style={{ margin: "6px 0 0" }}>아직 사업자등록증이 없어요. 사진을 올려 주세요 — 파트너 확인에 꼭 필요해요.</p>}
      <label className="f" style={{ marginTop: 8 }}>{state.count ? "새로 올리기" : "사진 고르기"} <span className="hint">2장까지</span>
        <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => void upload(e.target.files)} />
      </label>
      {busy && <p className="small muted" style={{ margin: "6px 0 0" }}>올리는 중…</p>}
      {msg && <p className={msg.ok ? "okmsg" : "err"} style={{ margin: "6px 0 0" }}>{msg.text}</p>}
    </section>
  );
}
