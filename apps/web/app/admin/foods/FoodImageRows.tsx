"use client";
/** 음식 사진 표 — 줄마다 주소·출처 입력과 저장(한 줄씩 /admin/api/foods). 미리보기는 적은 주소 그대로 */
import { useState } from "react";
import type { AdminFoodRow } from "@/lib/admin-foods";

function Row({ r }: { r: AdminFoodRow }) {
  const [url, setUrl] = useState(r.imageUrl);
  const [credit, setCredit] = useState(r.imageCredit);
  const [saved, setSaved] = useState({ url: r.imageUrl, credit: r.imageCredit });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = url !== saved.url || credit !== saved.credit;
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/admin/api/foods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, imageUrl: url, imageCredit: credit }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "저장 실패");
      setUrl(j.imageUrl); setCredit(j.imageCredit); setSaved({ url: j.imageUrl, credit: j.imageCredit }); setMsg("저장·발행됨");
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <tr>
      <td><code>{r.id}</code></td>
      <td>{r.name}<div className="muted" style={{ fontSize: 12 }}>{r.category}</div></td>
      <td>{url ? <img src={url} alt="" style={{ width: 48, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)", background: "#fff" }} /> : <span className="muted">없음</span>}</td>
      <td><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… 또는 /…" style={{ width: "100%", minWidth: 220 }} /></td>
      <td><input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="예: 직접 촬영" style={{ width: 140 }} /></td>
      <td style={{ whiteSpace: "nowrap" }}><button type="button" className="btn sm p" disabled={busy || !dirty} onClick={save}>{busy ? "저장 중…" : "저장"}</button>{msg && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>{msg}</span>}</td>
    </tr>
  );
}

export default function FoodImageRows({ rows }: { rows: AdminFoodRow[] }) {
  return (
    <table className="t">
      <thead><tr><th>id</th><th>이름</th><th>미리보기</th><th>사진 주소</th><th>출처</th><th></th></tr></thead>
      <tbody>{rows.map((r) => <Row key={r.id} r={r} />)}</tbody>
    </table>
  );
}
