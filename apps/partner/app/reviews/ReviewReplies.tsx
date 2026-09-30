"use client";
/**
 * 내 매장 리뷰 목록 + 답글(2026-10-01) — 리뷰마다 답글 한 개. 적고 저장하면 손님 화면에 "사장님 답글"로 바로 보인다(최대 10분).
 * 빈 칸으로 저장하면 답글이 지워진다.
 */
import { useState } from "react";
import { OWNER_REPLY_MAX } from "@pairinggo/shared";
import type { MerchantReview } from "@pairinggo/server/review-replies";

const VERIFY: Record<MerchantReview["verify"], string> = { reservation: "예약 방문", receipt: "영수증 인증" };
const day = (s: string) => s.slice(0, 10).replace(/-/g, ".");

function Item({ r }: { r: MerchantReview }) {
  const [reply, setReply] = useState(r.reply);
  const [text, setText] = useState(r.reply?.body ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save(body: string) {
    setBusy(true); setMsg("");
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, body }) });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; reply?: { body: string; at: string } | null; error?: string };
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? "저장하지 못했어요"); return; }
    setReply(j.reply ?? null); setText(j.reply?.body ?? ""); setOpen(false);
  }
  return (
    <li className="panel">
      <div className="row-between">
        <b>{"★".repeat(r.rating)}<span className="muted">{"★".repeat(5 - r.rating)}</span> {r.nickname}</b>
        <span className="small muted">{VERIFY[r.verify]} · {day(r.visitDate)} 방문</span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{r.body}</p>
      {r.photos.length > 0 && <div className="row" style={{ gap: 6 }}>{r.photos.map((u) => <img key={u} src={u} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} loading="lazy" />)}</div>}
      {reply && !open ? (
        <div className="reply">
          <div className="row-between"><b className="small">사장님 답글 <span className="muted">{day(reply.at)}</span></b><button type="button" className="btn sm ghost" onClick={() => setOpen(true)}>고치기</button></div>
          <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{reply.body}</p>
        </div>
      ) : open ? (
        <div style={{ marginTop: 10 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={OWNER_REPLY_MAX} placeholder="다녀가 주셔서 고맙습니다 — 손님에게 보이는 글이에요" />
          <div className="row-between" style={{ marginTop: 6 }}>
            <span className="small muted">{text.length}/{OWNER_REPLY_MAX} · 링크는 넣을 수 없어요</span>
            <span className="row" style={{ gap: 6 }}>
              {reply && <button type="button" className="btn sm danger" disabled={busy} onClick={() => save("")}>답글 지우기</button>}
              <button type="button" className="btn sm ghost" disabled={busy} onClick={() => { setOpen(false); setText(reply?.body ?? ""); }}>취소</button>
              <button type="button" className="btn sm primary" disabled={busy || !text.trim()} onClick={() => save(text)}>{busy ? "저장 중…" : "답글 저장"}</button>
            </span>
          </div>
          {msg && <p className="small" style={{ color: "var(--danger, #B8431F)", margin: "6px 0 0" }}>{msg}</p>}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => setOpen(true)}>답글 달기</button></div>
      )}
    </li>
  );
}

export default function ReviewReplies({ reviews }: { reviews: MerchantReview[] }) {
  if (!reviews.length) return <div className="panel"><p className="muted" style={{ margin: 0 }}>아직 방문 인증 리뷰가 없어요. 손님이 예약 방문이나 영수증으로 인증하고 남긴 리뷰가 여기에 모여요.</p></div>;
  return <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>{reviews.map((r) => <Item key={r.id} r={r} />)}</ul>;
}
