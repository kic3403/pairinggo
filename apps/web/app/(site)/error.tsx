"use client";
/** 화면 오류 — 사과 대신 다시 시도·홈으로. 오류는 /api/errors로 알려 어드민 /admin/errors에 모인다 */
import { useEffect } from "react";
import Link from "next/link";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message, digest: error.digest, path: location.pathname }), keepalive: true }).catch(() => {});
  }, [error]);
  return (
    <div className="wrap" style={{ padding: "40px 16px" }}>
      <h1>화면을 불러오지 못했어요</h1>
      <p className="lead">잠시 뒤 다시 시도해 주세요. 계속되면 운영자가 확인할 수 있게 기록해 두었어요.</p>
      <div className="btns">
        <button type="button" className="btn p" onClick={reset}>다시 시도</button>
        <Link className="btn" href="/">홈으로</Link>
      </div>
    </div>
  );
}
