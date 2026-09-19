"use client";
import { useState } from "react";

const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: !!r?.ok, status: r?.status ?? 0, j: ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, string> };
};

/** 휴대폰 문자 인증(예약·리뷰 공용) — 한 번 인증하면 회원 정보에 남는다. note: 번호를 어디에 쓰는지 한 줄 */
export default function PhoneVerify({ onDone, available, note = "예약 정보를 매장에 전달하고 확정 안내를 받을 번호예요. 한 번만 인증하면 돼요.", unavailable = "문자 인증을 준비하고 있어요 — 곧 앱에서 예약할 수 있어요. 급하면 매장에 전화해 주세요." }: { onDone: (masked: string) => void; available: boolean; note?: string; unavailable?: string }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ err?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  if (!available) return <p className="form-error">{unavailable}</p>;
  async function start() {
    setBusy(true);
    const r = await post("/api/phone", { op: "start", phone });
    setBusy(false);
    if (r.ok) { setSent(true); setMsg({ ok: `${r.j.phone}로 인증번호를 보냈어요(3분)` }); } else setMsg({ err: r.j.error ?? "보내지 못했어요" });
  }
  async function confirm() {
    setBusy(true);
    const r = await post("/api/phone", { op: "confirm", code });
    setBusy(false);
    if (r.ok) onDone(r.j.phone); else setMsg({ err: r.j.error ?? "확인하지 못했어요" });
  }
  return (
    <div>
      <p className="small muted" style={{ margin: "0 0 10px" }}>{note}</p>
      <div className="rsv-phone">
        <label className="field"><span>휴대폰 번호</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" /></label>
        <button type="button" className="btn" disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={start}>{sent ? "다시 받기" : "인증번호 받기"}</button>
      </div>
      {sent ? (
        <div className="rsv-phone" style={{ marginTop: 8 }}>
          <label className="field"><span>인증번호 6자리</span><input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
          <button type="button" className="btn p" disabled={busy || code.length !== 6} onClick={confirm}>확인</button>
        </div>
      ) : null}
      {msg.err ? <p className="form-error" role="alert">{msg.err}</p> : msg.ok ? <p className="form-ok" role="status">{msg.ok}</p> : null}
    </div>
  );
}
