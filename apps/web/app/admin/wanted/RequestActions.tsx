"use client";
/**
 * 회원 요청 처리 — 새 술로 등록(카탈로그에 넣고 요청을 '등록됨'으로) · 이미 있는 술이면 연결 · 보류(사유) · 되돌리기.
 * 2026-09-29: 카탈로그에 없어서 온 요청이라 새 술 등록을 먼저, 카탈로그에서 고르기는 뒤로(그새 들어온 경우만).
 */
import { useState } from "react";
import type { DrinkProfile } from "@pairinggo/shared";
import NewDrinkButton from "./NewDrinkButton";

type Props = { id: number; query: string; status: "open" | "done" | "rejected"; drinks: { id: string; name: string }[]; avg: Record<string, DrinkProfile> };

export default function RequestActions({ id, query, status, drinks, avg }: Props) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(false);
  const [name, setName] = useState("");
  async function run(next: "open" | "done" | "rejected") {
    let drinkId = "", note = "";
    if (next === "done") {
      const d = drinks.find((x) => x.name === name.trim()) ?? drinks.find((x) => x.name.replace(/\s/g, "") === name.replace(/\s/g, ""));
      if (!d) { alert("카탈로그에 있는 술 이름을 목록에서 골라 주세요 — 없는 술이면 '새 술로 등록'을 눌러 주세요"); return; }
      drinkId = d.id;
    }
    if (next === "rejected") { const n = window.prompt("보류 사유(요청자에게 보입니다, 선택)"); if (n === null) return; note = n; }
    setBusy(true);
    const r = await fetch("/admin/api/drink-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: next, drinkId, note }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "처리하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  if (status !== "open") return <button className="btn sm" disabled={busy} onClick={() => run("open")}>다시 열기</button>;
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <NewDrinkButton name={query} requestId={id} avg={avg} />
        <button className="btn sm" disabled={busy} onClick={() => run("rejected")}>보류</button>
      </div>
      {link ? (
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <input list={`drinks-${id}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="카탈로그 술 이름" style={{ width: 150 }} autoFocus />
          <datalist id={`drinks-${id}`}>{drinks.map((d) => <option key={d.id} value={d.name} />)}</datalist>
          <button className="btn sm" disabled={busy || !name.trim()} onClick={() => run("done")}>연결</button>
        </div>
      ) : (
        <button className="linkish small" onClick={() => setLink(true)}>이미 있는 술이면 연결</button>
      )}
    </div>
  );
}
