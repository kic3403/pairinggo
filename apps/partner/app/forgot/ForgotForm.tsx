"use client";
import { useState } from "react";

/** 파트너 비밀번호 재설정 — ① 이메일·담당자 휴대폰 → 인증번호 ② 인증번호·새 비밀번호 */
export function ForgotForm({ contact }: { contact: string }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err?: string; ok?: string }>({});

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    return { ok: !!r?.ok, j: ((await r?.json().catch(() => ({}))) ?? {}) as { error?: string } };
  };

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg({});
    const r = await post({ op: "start", email, phone });
    setBusy(false);
    if (!r.ok) { setMsg({ err: r.j.error ?? "잠시 뒤 다시 시도해 주세요" }); return; }
    setSent(true);
    setMsg({ ok: "이메일·번호가 가입 정보와 맞으면 인증번호 문자를 보냈어요(3분)." });
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) { setMsg({ err: "새 비밀번호 두 칸이 서로 달라요" }); return; }
    setBusy(true); setMsg({});
    const r = await post({ op: "confirm", email, phone, code: f.get("code"), password: f.get("password") });
    setBusy(false);
    if (!r.ok) { setMsg({ err: r.j.error ?? "재설정하지 못했어요" }); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="panel stack">
        <p className="okmsg" style={{ margin: 0 }}>비밀번호를 바꿨어요. 다른 기기의 로그인은 모두 끊겼어요.</p>
        <a className="btn primary block" href="/login">새 비밀번호로 로그인</a>
      </div>
    );
  }
  return (
    <div className="stack">
      <form className="panel stack" onSubmit={start}>
        <label className="f">가입한 이메일<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" disabled={sent} /></label>
        <label className="f">담당자 휴대폰 <span className="hint">가입할 때 적은 번호</span><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" disabled={sent} placeholder="010-0000-0000" /></label>
        {!sent ? <button className="btn primary block" disabled={busy}>{busy ? "보내는 중…" : "인증번호 받기"}</button> : null}
      </form>
      {sent ? (
        <form className="panel stack" onSubmit={confirm}>
          <label className="f">인증번호 6자리<input type="text" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></label>
          <label className="f">새 비밀번호 <span className="hint">8자 이상, 숫자만으로는 안 돼요</span><input type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="f">새 비밀번호 확인<input type="password" name="password2" required minLength={8} autoComplete="new-password" /></label>
          <button className="btn primary block" disabled={busy}>{busy ? "바꾸는 중…" : "비밀번호 바꾸기"}</button>
          <button type="button" className="linklike" onClick={() => { setSent(false); setMsg({}); }}>이메일·번호 다시 입력 / 인증번호 다시 받기</button>
        </form>
      ) : null}
      {msg.err ? <p className="err" role="alert">{msg.err}</p> : msg.ok ? <p className="okmsg" role="status">{msg.ok}</p> : null}
      <p className="small muted">담당자 번호가 바뀌었다면 {contact}로 알려 주세요.</p>
    </div>
  );
}
