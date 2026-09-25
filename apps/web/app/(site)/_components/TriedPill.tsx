"use client";
/**
 * 하단 알약(캐치테이블 "작성할 리뷰 1"식, 2026-09-25) — 로그인 회원에게 "먹어봤나요? N"을 탭바 위에 띄운다. 저장한 술·음식의 미평가 조합 수(/api/tried).
 * 홈에서만, 0이면 안 보인다. 누르면 마이페이지의 먹어봤나요 칸으로.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSaved } from "./SavedProvider";

export default function TriedPill() {
  const { ready, loggedIn } = useSaved();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ready || !loggedIn) { setN(0); return; }
    fetch("/api/tried").then((r) => (r.ok ? r.json() : { count: 0 })).then((j: { count: number }) => setN(j.count || 0)).catch(() => setN(0));
  }, [ready, loggedIn]);
  if (!n) return null;
  return <Link href="/my#tried" className="tried-pill">먹어봤나요? <b>{n}</b> <span aria-hidden>›</span></Link>;
}
