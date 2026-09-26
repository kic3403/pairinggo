"use client";
/** 회원 요청 처리 — 등록됨(카탈로그 술 이름 고르기) · 보류(사유) · 되돌리기 */
import { useState } from "react";

export default function RequestActions({ id, status, drinks }: { id: number; status: "open" | "done" | "rejected"; drinks: { id: string; name: string }[] }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  async function run(next: "open" | "done" | "rejected") {
    let drinkId = "", note = "";
    if (next === "done") {
      const d = drinks.find((x) => x.name === name.trim()) ?? drinks.find((x) => x.name.replace(/\s/g, "") === name.replace(/\s/g, ""));
      if (!d) { alert("카탈로그에 있는 술 이름을 골라 주세요(먼저 add-drinks로 넣은 뒤)"); return; }
      drinkId = d.id;
    }
    if (next === "rejected") note = window.prompt("보류 사유(요청자에게 보입니다, 선택)") ?? "";
    setBusy(true);
    const r = await fetch("/admin/api/drink-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: next, drinkId, note }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) { alert(j.error ?? "처리하지 못했어요"); setBusy(false); return; }
    location.reload();
  }
  if (status !== "open") return <button className="btn sm" disabled={busy} onClick={() => run("open")}>다시 열기</button>;
  return (
    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <input list={`drinks-${id}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="등록한 술 이름" style={{ width: 150 }} />
      <datalist id={`drinks-${id}`}>{drinks.map((d) => <option key={d.id} value={d.name} />)}</datalist>
      <button className="btn sm p" disabled={busy || !name.trim()} onClick={() => run("done")}>등록됨</button>
      <button className="btn sm" disabled={busy} onClick={() => run("rejected")}>보류</button>
    </div>
  );
}
