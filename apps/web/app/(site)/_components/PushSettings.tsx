"use client";
/**
 * 푸시 알림 설정(docs/25 §7) — 마이페이지. 이 기기에서 받기(켜기/끄기·시험 알림) + 무엇을 받을지(주간 소식·활동 소식).
 * 예약·주문 알림은 설정과 무관하게 기기 알림이 켜져 있으면 온다(notify·notify-order).
 */
import { useEffect, useState } from "react";
import { currentSubscription, pushSupport, subscribePush, unsubscribePush } from "@pairinggo/shared/push-client";
import { track } from "@/lib/track";

type Pref = { weekly: boolean; activity: boolean };

export default function PushSettings() {
  const [on, setOn] = useState<boolean | null>(null);
  const [pref, setPref] = useState<Pref | null>(null);
  const [devices, setDevices] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => null);
    currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false));
    fetch("/api/push/pref", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.pref) { setPref(j.pref); setDevices(j.devices ?? 0); } }).catch(() => {});
  }, []);

  const turnOn = async () => {
    setBusy(true); setMsg("");
    const r = await subscribePush(key);
    setBusy(false);
    if (r.ok) { setOn(true); setDevices((n) => n + 1); setMsg("이 기기에서 알림을 받아요."); track("push_on"); } else setMsg(r.problem);
  };
  const turnOff = async () => { setBusy(true); await unsubscribePush(); setOn(false); setDevices((n) => Math.max(0, n - 1)); setMsg("이 기기 알림을 껐어요."); setBusy(false); track("push_off"); };
  const test = async () => {
    setBusy(true);
    const r = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { sent?: number; error?: string } | undefined;
    setBusy(false);
    setMsg(r?.ok ? `시험 알림을 보냈어요(${j?.sent ?? 0}대).` : j?.error ?? "보내지 못했어요.");
  };
  const toggle = async (k: keyof Pref) => {
    if (!pref) return;
    const next = { ...pref, [k]: !pref[k] };
    setPref(next);
    const r = await fetch("/api/push/pref", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [k]: next[k] }) }).catch(() => null);
    if (!r?.ok) { setPref(pref); setMsg("설정을 저장하지 못했어요."); }
  };

  if (!key || on === null) return null;
  const sup = pushSupport();
  return (
    <section className="box push-settings" aria-label="푸시 알림">
      <h3>푸시 알림 <span className="muted small">{devices > 0 ? `켠 기기 ${devices}대` : "꺼짐"}</span></h3>
      <p className="small muted" style={{ margin: "0 0 10px" }}>다시 올 이유를 기기로 보내 드려요 — 월요일 아침 주간 소식(저장한 술의 새 페어링·급상승·새 술·먹어봤나요?)과 활동 소식(요청한 술 등록, 내 추천에 하트). 예약·주문 알림은 기기 알림만 켜져 있으면 와요.</p>
      {sup === "unsupported" ? <p className="small muted">이 브라우저는 푸시를 지원하지 않아요.</p> : (
        <div className="btns" style={{ margin: 0 }}>
          {on ? <><button type="button" className="btn" disabled={busy} onClick={test}>시험 알림</button><button type="button" className="btn" disabled={busy} onClick={turnOff}>이 기기 끄기</button></>
            : <button type="button" className="btn p" disabled={busy} onClick={turnOn}>이 기기에서 알림 받기</button>}
          {sup === "ios-install" && !on && <span className="small muted">아이폰은 공유 → ‘홈 화면에 추가’ 뒤 그 앱에서 켤 수 있어요.</span>}
        </div>
      )}
      {pref && (
        <div className="push-prefs">
          <label><input type="checkbox" checked={pref.weekly} onChange={() => toggle("weekly")} /> 주간 소식 <span className="small muted">월요일 아침, 내용이 있을 때만</span></label>
          <label><input type="checkbox" checked={pref.activity} onChange={() => toggle("activity")} /> 활동 소식 <span className="small muted">요청한 술 등록·보류, 내 추천에 하트</span></label>
        </div>
      )}
      {msg && <p className="small muted" role="status" style={{ margin: "8px 0 0" }}>{msg}</p>}
    </section>
  );
}
