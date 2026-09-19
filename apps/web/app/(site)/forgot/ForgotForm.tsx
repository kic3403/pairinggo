"use client";
import { useState } from "react";
import Link from "next/link";
import PasswordField from "../_components/PasswordField";

/** 비밀번호 재설정 — ① 이메일·휴대폰 → 인증번호 ② 인증번호·새 비밀번호 */
export default function ForgotForm({ contact }: { contact: string }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err?: string; ok?: string }>({});

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/account/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    return { ok: !!r?.ok, j: ((await r?.json().catch(() => ({}))) ?? {}) as { error?: string } };
  };

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg({});
    const r = await post({ op: "start", email, phone });
    setBusy(false);
    if (!r.ok) { setMsg({ err: r.j.error ?? "잠시 뒤 다시 시도해 주세요" }); return; }
    setSent(true);
    setMsg({ ok: "입력한 이메일·번호가 가입 정보와 맞으면 인증번호 문자를 보냈어요(3분). 문자가 오지 않으면 이메일·번호를 다시 확인해 주세요." });
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
      <div>
        <p className="form-ok">비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.</p>
        <Link className="btn p" href="/login" style={{ width: "100%" }}>로그인하러 가기</Link>
      </div>
    );
  }
  return (
    <>
      <form onSubmit={start} style={{ marginTop: 18 }}>
        <label className="field"><span>가입한 이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={sent} placeholder="name@example.com" /></label>
        <label className="field"><span>인증한 휴대폰 번호</span><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" disabled={sent} placeholder="010-0000-0000" /></label>
        {!sent ? <button type="submit" className="btn p" style={{ width: "100%" }} disabled={busy}>{busy ? "보내는 중…" : "인증번호 받기"}</button> : null}
      </form>
      {sent ? (
        <form onSubmit={confirm} style={{ marginTop: 14 }}>
          <label className="field"><span>인증번호 6자리</span><input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></label>
          <PasswordField name="password" label="새 비밀번호" hint="8자 이상" autoComplete="new-password" minLength={8} />
          <PasswordField name="password2" label="새 비밀번호 확인" autoComplete="new-password" minLength={8} confirmOf="password" />
          <button type="submit" className="btn p" style={{ width: "100%" }} disabled={busy}>{busy ? "바꾸는 중…" : "비밀번호 바꾸기"}</button>
          <p className="small muted" style={{ marginTop: 10 }}>
            <button type="button" className="linklike" onClick={() => { setSent(false); setMsg({}); }}>이메일·번호 다시 입력 / 인증번호 다시 받기</button>
          </p>
        </form>
      ) : null}
      {msg.err ? <p className="form-error" role="alert">{msg.err}</p> : msg.ok ? <p className="form-ok" role="status">{msg.ok}</p> : null}
      <p className="small muted" style={{ marginTop: 18 }}>
        문자 재설정은 <b>식당 예약 때 휴대폰을 인증한 이메일 회원</b>만 할 수 있어요. 번호를 인증한 적이 없거나 간편로그인(카카오·네이버·구글)으로 가입했다면, 가입한 이메일로 {contact}에 알려 주세요.
      </p>
    </>
  );
}
