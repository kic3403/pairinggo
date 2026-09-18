"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking } from "@/lib/bookings";

const ACTION_LABEL: Record<string, string> = { seated: "착석", completed: "완료", no_show: "노쇼", cancelled_by_store: "매장 취소" };
const TONE: Record<string, string> = { confirmed: "", seated: " ok", completed: " mute", no_show: " bad", cancelled_by_user: " mute", cancelled_by_store: " mute" };

/** 예약 카드 목록 — 상태 버튼, 20초마다 새로고침(새 예약·손님 취소가 바로 보이게) */
export function BookingBoard({ items, live = false, showDate = false }: { items: Booking[]; live?: boolean; showDate?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 20_000);
    return () => clearInterval(t);
  }, [live, router]);

  async function act(b: Booking, to: string) {
    let note = "";
    if (to === "cancelled_by_store") {
      note = window.prompt(`${b.guestName}님 ${b.time} 예약을 취소하는 사유(손님에게 전달돼요)`)?.trim() ?? "";
      if (!note) return;
    } else if (to === "no_show" && !confirm(`${b.guestName}님 ${b.time} 예약을 노쇼로 처리할까요?`)) return;
    setBusy(b.id); setErr({ ...err, [b.id]: "" });
    const r = await fetch(`/api/reservations/${b.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, note }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(null);
    if (!r?.ok) { setErr({ ...err, [b.id]: j?.error ?? "처리하지 못했어요" }); return; }
    router.refresh();
  }

  if (!items.length) return <p className="panel muted">예약이 없어요.</p>;
  return (
    <ul className="bookings">
      {items.map((b) => {
        const done = !["confirmed", "seated"].includes(b.status);
        return (
          <li key={b.id} className={`booking${done ? " done" : ""}`}>
            <div className="bk-time num">{showDate ? <small>{Number(b.date.slice(5, 7))}/{Number(b.date.slice(8))}</small> : null}{b.time}</div>
            <div className="bk-main">
              <div className="bk-top">
                <b>{b.guestName}</b><span className="num">{b.partySize}명</span>
                <span className={`chip${TONE[b.status] ?? ""}`}>{b.statusLabel}</span>
              </div>
              <div className="bk-sub">
                {b.phone ? (open[b.id] ? <a href={`tel:${b.phone.replace(/\D/g, "")}`}>{b.phone}</a> : <button type="button" className="linklike" onClick={() => setOpen({ ...open, [b.id]: true })}>{b.phoneMasked} · 번호 보기</button>) : <span className="muted">{b.phoneMasked ? `${b.phoneMasked}(보관 기간 지남)` : "번호 없음"}</span>}
                <span className="muted"> · {b.code}</span>
              </div>
              {b.roomRequested || b.bringOwnDrink ? <div className="bk-flags">{b.roomRequested ? <span className="chip warn">룸 희망</span> : null}{b.bringOwnDrink ? <span className="chip warn">술 지참</span> : null}</div> : null}
              {b.pairing ? <div className="bk-sub"><span className="muted">페어링</span> {b.pairing}</div> : null}
              {b.note ? <div className="bk-note">{b.note}</div> : null}
              {b.cancelReason ? <div className="bk-sub muted">취소 사유 · {b.cancelReason}</div> : null}
              {b.actions.length ? (
                <div className="bk-actions">
                  {b.actions.map((a) => (
                    <button key={a} type="button" disabled={busy === b.id} onClick={() => act(b, a)}
                      className={`btn sm ${a === "seated" ? "primary" : a === "completed" ? "ghost" : "danger"}`}>{ACTION_LABEL[a]}</button>
                  ))}
                </div>
              ) : null}
              {err[b.id] ? <p className="err" style={{ marginTop: 8 }}>{err[b.id]}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
