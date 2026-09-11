"use client";
/** 저장(찜) 버튼 — 로그인해야 동작한다. 비로그인이면 로그인 페이지로 보낸다. */
import { useEffect, useState } from "react";

export default function SaveButton({ kind, id, name }: { kind: "drink" | "food"; id: string; name: string }) {
  const [state, setState] = useState<"loading" | "guest" | "on" | "off">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await fetch("/api/auth/session").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive) return;
      if (!s?.user) { setState("guest"); return; }
      const j = await fetch("/api/saved").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive) return;
      const hit = (j?.items || []).some((x: { kind: string; item_id: string }) => x.kind === kind && x.item_id === id);
      setState(hit ? "on" : "off");
    })();
    return () => { alive = false; };
  }, [kind, id]);

  if (state === "loading") return null;
  if (state === "guest") return <a className="btn" href={`/login?next=${encodeURIComponent(typeof location === "undefined" ? "/" : location.pathname)}`}>♡ 저장하려면 로그인</a>;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) });
      if (r.ok) setState((await r.json()).saved ? "on" : "off");
    } finally { setBusy(false); }
  };

  return (
    <button className="btn" onClick={toggle} disabled={busy} aria-pressed={state === "on"} aria-label={`${name} ${state === "on" ? "저장 해제" : "저장"}`}>
      {state === "on" ? "♥ 저장됨" : "♡ 저장"}
    </button>
  );
}
