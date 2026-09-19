"use client";
/** 파트너 앱 화면 오류 — 다시 시도·오늘로. 오류는 /api/errors로 기록 */
import { useEffect } from "react";

export default function PartnerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message, digest: error.digest, path: location.pathname }), keepalive: true }).catch(() => {});
  }, [error]);
  return (
    <main>
      <h1>화면을 불러오지 못했어요</h1>
      <p className="lead">잠시 뒤 다시 시도해 주세요. 예약 확인이 급하면 새로고침하거나 오늘 화면으로 가 보세요.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn primary" onClick={reset}>다시 시도</button>
        <a className="btn ghost" href="/">오늘 화면</a>
      </div>
    </main>
  );
}
