"use client";
import { useEffect, useState } from "react";
import { currentSubscription, pushSupport, subscribePush, unsubscribePush } from "@pairinggo/shared/push-client";

/** 예약 알림(확정·매장 취소·당일 안내) 이 기기에서 받기 */
export default function PushButton() {
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false)); }, []);
  if (on === null || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null;
  const sup = pushSupport();
  if (sup === "unsupported") return null;
  return (
    <p className="small" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {on ? (
        <><span className="muted">이 기기에서 예약 알림을 받아요.</span><button type="button" className="linklike" onClick={async () => { await unsubscribePush(); setOn(false); }}>끄기</button></>
      ) : (
        <button type="button" className="btn sm" onClick={async () => {
          const r = await subscribePush(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "");
          if (r.ok) { setOn(true); setMsg(""); } else setMsg(r.problem);
        }}>예약 알림 받기</button>
      )}
      {msg ? <span className="muted">{msg}</span> : null}
    </p>
  );
}
