"use client";
/**
 * 헤더 로그인 상태 — 클라이언트에서 세션을 가져온다.
 * 서버 컴포넌트에서 auth()를 부르면 모든 공개 페이지가 동적 렌더로 바뀌어 검색 유입용 정적 생성이 깨진다.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

type Session = { user?: { name?: string | null; id?: string } } | null;

export default function AuthNav() {
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) { setSession(j && j.user ? j : null); setReady(true); } })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  // 세션을 확인하기 전에는 자리만 잡아 둔다 (레이아웃이 흔들리지 않게)
  if (!ready) return <span style={{ width: 52 }} aria-hidden />;

  if (!session?.user) return <Link href="/login">로그인</Link>;
  return (
    <>
      <Link href="/saved">저장{session.user.name ? ` · ${session.user.name}` : ""}</Link>
      <form action="/api/auth/signout" method="post" style={{ display: "inline" }}>
        <button type="submit" className="linklike">로그아웃</button>
      </form>
    </>
  );
}
