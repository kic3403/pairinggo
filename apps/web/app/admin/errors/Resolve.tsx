"use client";
import { useState } from "react";

export default function Resolve({ id }: { id: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn sm" disabled={busy} onClick={async () => {
      setBusy(true);
      const r = await fetch("/admin/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (r.ok) location.reload(); else { alert("처리하지 못했어요"); setBusy(false); }
    }}>해결</button>
  );
}
