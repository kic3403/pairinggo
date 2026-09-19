"use client";
import { useState } from "react";
import type { OAuthProvider } from "@pairinggo/shared";

const LABEL: Record<OAuthProvider, string> = { kakao: "카카오", naver: "네이버" };
const RESULT: Record<string, string> = {
  linked: "연결했어요 — 다음부터 간편로그인으로 들어올 수 있어요",
  already: "이미 연결된 계정이에요",
  taken: "다른 파트너 계정에 연결된 계정이에요 — 운영자에게 문의해 주세요",
  cancel: "연결을 취소했어요",
  fail: "연결하지 못했어요 — 잠시 뒤 다시 시도해 주세요",
};

/** 로그인 방법 — 이메일(비밀번호) · 카카오 · 네이버 연결/끊기 */
export function AccountSection({ email, hasPassword, linked, enabled, result }: { email: string; hasPassword: boolean; linked: OAuthProvider[]; enabled: OAuthProvider[]; result?: string }) {
  const [list, setList] = useState(linked);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>(result && RESULT[result] ? (result === "linked" || result === "already" ? { ok: RESULT[result] } : { err: RESULT[result] }) : {});
  async function unlink(p: OAuthProvider) {
    if (!confirm(`${LABEL[p]} 연결을 끊을까요?`)) return;
    const r = await fetch(`/api/oauth/${p}/unlink`, { method: "POST" }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (r?.ok) { setList(list.filter((x) => x !== p)); setMsg({ ok: `${LABEL[p]} 연결을 끊었어요` }); } else setMsg({ err: j?.error ?? "끊지 못했어요" });
  }
  const shown = (["kakao", "naver"] as OAuthProvider[]).filter((p) => enabled.includes(p) || list.includes(p));
  return (
    <section className="panel stack" id="account">
      <div>
        <h2 style={{ margin: 0 }}>로그인 방법</h2>
        <p className="small muted" style={{ margin: "2px 0 0" }}>카카오·네이버를 연결하면 비밀번호 없이 간편로그인으로 들어올 수 있어요.</p>
      </div>
      <ul className="acct">
        <li><span>이메일 <span className="muted small">{email}</span></span>{hasPassword ? <span className="chip ok">비밀번호 있음</span> : <a className="linklike" href="/forgot">비밀번호 만들기</a>}</li>
        {shown.map((p) => (
          <li key={p}>
            <span>{LABEL[p]}</span>
            {list.includes(p)
              ? <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="chip ok">연결됨</span><button type="button" className="linklike" onClick={() => unlink(p)}>끊기</button></span>
              : <a className={`btn sm social-${p}`} style={{ minHeight: 34 }} href={`/api/oauth/${p}/start?mode=link`}>{LABEL[p]} 연결</a>}
          </li>
        ))}
      </ul>
      {msg.err ? <p className="err" style={{ margin: 0 }}>{msg.err}</p> : msg.ok ? <p className="okmsg" style={{ margin: 0 }}>{msg.ok}</p> : null}
    </section>
  );
}
