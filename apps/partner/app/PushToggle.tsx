"use client";
import { useEffect, useState } from "react";
import { currentSubscription, pushSupport, subscribePush, unsubscribePush } from "@pairinggo/shared/push-client";

/** 이 기기에서 새 예약·손님 취소 알림 받기 — 매장 태블릿·사장님 휴대폰마다 켠다 */
export function PushToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => null);
    currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false));
  }, []);
  async function turnOn() {
    setBusy(true); setMsg("");
    const r = await subscribePush(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "");
    setBusy(false);
    if (r.ok) { setOn(true); setMsg("이 기기에서 알림을 받아요"); } else setMsg(r.problem);
  }
  async function test() {
    setBusy(true);
    const r = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string; sent?: number } | undefined;
    setBusy(false);
    setMsg(r?.ok ? `시험 알림을 보냈어요(${j?.sent ?? 0}대)` : j?.error ?? "보내지 못했어요");
  }
  if (on === null) return null;
  const sup = pushSupport();
  return (
    <div className="push">
      {on ? (
        <>
          <span className="chip ok">이 기기 알림 켜짐</span>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={test}>시험 알림</button>
          <button type="button" className="linklike" disabled={busy} onClick={async () => { await unsubscribePush(); setOn(false); setMsg("알림을 껐어요"); }}>끄기</button>
        </>
      ) : (
        <>
          <button type="button" className="btn primary sm" disabled={busy} onClick={turnOn}>이 기기에서 새 예약 알림 받기</button>
          {sup === "ios-install" ? <span className="muted">아이폰은 공유 → ‘홈 화면에 추가’ 후 그 앱에서 켜 주세요</span> : null}
        </>
      )}
      {msg ? <span>{msg}</span> : null}
    </div>
  );
}
