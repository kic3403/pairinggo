"use client";
import { useState } from "react";

export function LoginForm() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (r?.ok) { location.href = "/"; return; }
    setBusy(false); setErr(j?.error ?? "로그인하지 못했어요 — 잠시 뒤 다시 시도해 주세요");
  }
  return (
    <form className="panel stack" onSubmit={submit}>
      <label className="f">이메일<input type="email" name="email" autoComplete="username" required /></label>
      <label className="f">비밀번호<input type="password" name="password" autoComplete="current-password" required /></label>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button className="btn primary block" disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
    </form>
  );
}
