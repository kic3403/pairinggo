"use client";
/**
 * 어드민 전문가 활동 탭(2026-09-29 사용자 요청) — 승인·정지된 전문가별 판정 수와 판정 목록. 잘못된 판정은 지운다(근거 줄·올린 등급·배지 집계도 되돌림).
 */
import { useState } from "react";
import type { ExpertActivity } from "@/lib/experts";

const VERDICT: Record<string, { label: string; cls: string }> = { yes: { label: "어울림", cls: "g" }, neutral: { label: "보통", cls: "m" }, no: { label: "아님", cls: "v" } };
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }) : "-");
const SHOW = 20;

function ExpertBlock({ x }: { x: ExpertActivity }) {
  const [reviews, setReviews] = useState(x.reviews);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove(id: number, label: string) {
    if (!confirm(`${label} 판정을 지울까요? 카드의 근거 줄과 배지 집계도 함께 되돌아가요.`)) return;
    setBusy(true);
    const r = await fetch("/admin/api/experts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: x.userId, action: "review-remove", reviewId: id }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) alert(j.error ?? "지우지 못했어요"); else setReviews((rs) => rs.filter((v) => v.id !== id));
    setBusy(false);
  }
  const shown = all ? reviews : reviews.slice(0, SHOW);
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <b style={{ fontSize: 16 }}>{x.displayName}</b>
        <span className={`tag${x.status === "approved" ? " g" : " v"}`}>{x.status === "approved" ? "전문가 등급" : "정지"}</span>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <span className="tag">판정 {x.counts.total}</span>
        <span className="tag g">어울림 {x.counts.yes}</span>
        <span className="tag m">보통 {x.counts.neutral}</span>
        <span className="tag v">아님 {x.counts.no}</span>
        <span className="tag w">최근 30일 {x.counts.last30}</span>
      </div>
      <div className="muted" style={{ marginTop: 6 }}>승인 {fmt(x.approvedAt)} · 첫 판정 {fmt(x.firstAt)} · 마지막 판정 {fmt(x.lastAt)}</div>
      {reviews.length === 0 ? <p className="muted" style={{ marginTop: 8 }}>아직 판정이 없어요.</p> : (
        <table className="t" style={{ marginTop: 10 }}>
          <thead><tr><th>조합</th><th>판정</th><th>한 줄 이유</th><th>날짜</th><th /></tr></thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id}>
                <td>{v.drinkHref ? <a href={v.drinkHref} target="_blank" rel="noreferrer">{v.drink}</a> : v.drink} × {v.food}</td>
                <td><span className={`tag ${VERDICT[v.verdict]?.cls ?? "m"}`}>{VERDICT[v.verdict]?.label ?? v.verdict}</span></td>
                <td>{v.note || <span className="muted">없음</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmt(v.at)}</td>
                <td><button className="btn sm d" disabled={busy} onClick={() => remove(v.id, `${v.drink} × ${v.food}`)}>지우기</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {reviews.length > SHOW && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setAll((a) => !a)}>{all ? "접기" : `판정 ${reviews.length}개 모두 보기`}</button>}
    </div>
  );
}

export default function ExpertActivityList({ items }: { items: ExpertActivity[] }) {
  if (!items.length) return <div className="card muted">전문가 등급으로 승인된 회원이 아직 없어요.</div>;
  return <>{items.map((x) => <ExpertBlock key={x.userId} x={x} />)}</>;
}
