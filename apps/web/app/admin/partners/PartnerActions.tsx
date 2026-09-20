"use client";
import { useState } from "react";
import { PARTNER_KINDS, PARTNER_KIND_LABEL, type PartnerKind } from "@pairinggo/shared";

type Status = "applied" | "approved" | "rejected" | "suspended";
const ACTIONS: Record<Status, { action: string; label: string; reason?: boolean }[]> = {
  applied: [{ action: "approve", label: "승인" }, { action: "reject", label: "반려", reason: true }],
  approved: [{ action: "suspend", label: "정지", reason: true }],
  suspended: [{ action: "resume", label: "재개" }],
  rejected: [{ action: "approve", label: "다시 승인" }],
};

type Hit = { id: string; name: string; category: string; address: string; phone: string | null };

/** 직접 입력 매장 → 카카오맵 장소 연결: 검색(어드민 식당 찾기 API) → 고르면 연결. 연결 뒤에야 페어링GO 검색·예약에 나온다 */
function LinkKakao({ id, name, address }: { id: string; name: string; address: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(`${address.split(" ").slice(0, 2).join(" ")} ${name}`.trim());
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true);
    const r = await fetch(`/admin/api/places/search?q=${encodeURIComponent(q)}`).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { places?: Hit[]; error?: string } | undefined;
    setHits(j?.places ?? []); setBusy(false);
    if (j?.error) alert(j.error);
  }
  async function link(h: Hit) {
    if (!confirm(`"${h.name}"(${h.address})에 연결할까요?\n연결하면 이 매장이 페어링GO 식당 검색·예약 화면에 나와요.`)) return;
    setBusy(true);
    const r = await fetch("/admin/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "link", kakaoId: h.id, query: q }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "연결하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  if (!open) return <button className="btn sm" onClick={() => setOpen(true)}>카카오맵 장소 연결</button>;
  return (
    <div style={{ width: "100%", marginTop: 6 }}>
      <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="동네 + 상호" style={{ flex: 1, minWidth: 0 }} />
        <button className="btn sm p" disabled={busy || q.trim().length < 2}>찾기</button>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>닫기</button>
      </form>
      {hits ? (hits.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: 4 }}>
          {hits.map((h) => (
            <li key={h.id}><button className="btn sm" style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }} disabled={busy} onClick={() => link(h)}>
              <b>{h.name}</b>&nbsp;<span className="muted">{[h.category, h.address, h.phone].filter(Boolean).join(" · ")}</span>
            </button></li>
          ))}
        </ul>
      ) : <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>검색 결과가 없어요 — 카카오맵에 아직 없으면 사장님께 카카오맵 앱의 장소 등록 요청을 부탁해 주세요.</p>) : null}
    </div>
  );
}

export default function PartnerActions({ id, status, manual, name, address, kind }: { id: string; status: Status; manual?: boolean; name?: string; address?: string; kind: PartnerKind }) {
  const [busy, setBusy] = useState(false);
  /** 업종 바꾸기 — 사장님이 잘못 고르고 신청했을 때 */
  async function changeKind(next: string) {
    if (next === kind) return;
    setBusy(true);
    const r = await fetch("/admin/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "kind", kind: next }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "바꾸지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  async function run(action: string, needsReason?: boolean) {
    const reason = needsReason ? window.prompt("사유(사장님 화면에 보여요)") : "";
    if (needsReason && !reason?.trim()) return;
    setBusy(true);
    const r = await fetch("/admin/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, reason }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "처리하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  return (
    <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
      {ACTIONS[status].map((a) => (
        <button key={a.action} className={`btn sm${a.action === "approve" || a.action === "resume" ? " p" : ""}`} disabled={busy} onClick={() => run(a.action, a.reason)}>{a.label}</button>
      ))}
      {manual ? <LinkKakao id={id} name={name ?? ""} address={address ?? ""} /> : null}
      <label className="row" style={{ gap: 4, alignItems: "center", fontSize: 13 }}>
        <span className="muted">업종</span>
        <select value={kind} disabled={busy} onChange={(e) => void changeKind(e.target.value)}>
          {PARTNER_KINDS.map((k) => <option key={k} value={k}>{PARTNER_KIND_LABEL[k]}</option>)}
        </select>
      </label>
    </div>
  );
}
