"use client";
/** 텍스트를 클립보드로 — 리포트 "글로 복사" */
import { useState } from "react";

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<null | "ok" | "fail">(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone("ok"); }
    catch { setDone("fail"); }
    setTimeout(() => setDone(null), 2500);
  };
  return (
    <>
      <button type="button" className="btn" onClick={copy}>{label}</button>
      {done === "ok" && <span className="small" style={{ color: "#2F6B3A" }}>복사했어요</span>}
      {done === "fail" && <span className="small form-error">복사하지 못했어요 — 아래 글을 직접 선택해 복사해 주세요</span>}
    </>
  );
}
