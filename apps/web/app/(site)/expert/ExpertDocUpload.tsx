"use client";
/** 검수 화면 — 자격증 더 올리기(2026-09-29). 운영자만 보고 공개하지 않는다. 3장을 넘으면 오래된 것부터 바뀐다 */
import { useState } from "react";
import { EXPERT_DOCS_MAX, EXPERT_DOC_MAX_BYTES } from "@pairinggo/shared/expert";
import { shrinkToJpegFile } from "@pairinggo/shared/image-client";
import { MEMBER_IMAGE_TYPES } from "@pairinggo/shared/member";

export default function ExpertDocUpload({ count }: { count: number }) {
  const [n, setN] = useState(count);
  const [open, setOpen] = useState(count === 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function upload(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, EXPERT_DOCS_MAX);
    if (!files.length) return;
    if (files.some((f) => !(MEMBER_IMAGE_TYPES as readonly string[]).includes(f.type) || f.size > EXPERT_DOC_MAX_BYTES)) { setMsg({ ok: false, text: "JPG·PNG·WebP 5MB 이하 사진만 올릴 수 있어요" }); return; }
    setBusy(true); setMsg(null);
    const fd = new FormData();
    // 긴 변 1,600px JPEG로 줄여 보낸다(서버 본문 한도 4.5MB)
    try { for (const f of await Promise.all(files.map((f) => shrinkToJpegFile(f, 1600)))) fd.append("doc", f); }
    catch { setMsg({ ok: false, text: "사진을 읽지 못했어요 — 다른 사진으로 바꿔 주세요" }); setBusy(false); return; }
    const r = await fetch("/api/expert/docs", { method: "POST", body: fd }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { count?: number; error?: string } | undefined;
    if (r?.ok) { setN(j?.count ?? n + files.length); setMsg({ ok: true, text: "자격증을 올렸어요 — 운영자가 확인해요." }); }
    else setMsg({ ok: false, text: j?.error ?? "올리지 못했어요 — 잠시 뒤 다시 시도해 주세요" });
    setBusy(false);
  }
  return (
    <div className="box small" style={{ marginBottom: 14 }}>
      <div className="row" style={{ border: 0, padding: 0, justifyContent: "space-between", gap: 8 }}>
        <span>{n > 0 ? <>자격증 <b>{n}장</b> 등록됨 · 운영자만 봐요</> : <b style={{ color: "var(--food-ink)" }}>자격증 사진이 아직 없어요 — 올려 주세요(운영자만 봐요)</b>}</span>
        {!open && <button type="button" className="btn sm" onClick={() => setOpen(true)}>자격증 더 올리기</button>}
      </div>
      {open && (
        <label className="mp-field" style={{ marginTop: 8 }}>
          <span>자격증·명함·재직 확인 사진 <span className="muted" style={{ fontWeight: 400 }}>{EXPERT_DOCS_MAX}장까지 · 넘으면 오래된 것부터 바뀌어요</span></span>
          <input type="file" accept={(MEMBER_IMAGE_TYPES as readonly string[]).join(",")} multiple disabled={busy} onChange={(e) => void upload(e.target.files)} />
        </label>
      )}
      {busy && <p className="muted" style={{ margin: "6px 0 0" }}>올리는 중…</p>}
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} style={{ margin: "6px 0 0" }}>{msg.text}</p>}
    </div>
  );
}
