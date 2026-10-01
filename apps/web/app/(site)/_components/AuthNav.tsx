"use client";
/**
 * 헤더 로그인 상태 — 세션은 SavedProvider가 한 번만 받아 둔 것을 쓴다.
 * 서버 컴포넌트에서 auth()를 부르면 모든 공개 페이지가 동적 렌더로 바뀌어 검색 유입용 정적 생성이 깨진다.
 */
import Link from "next/link";
import { useSaved } from "./SavedProvider";

export default function AuthNav() {
  const { ready, loggedIn, user, expert, guest } = useSaved();

  // 확인 전에는 자리만 잡아 둔다 (레이아웃이 흔들리지 않게)
  if (!ready) return <span style={{ width: 52 }} aria-hidden />;
  // 비로그인으로 하트를 눌러 둔 게 있으면 기기 저장 목록(/saved)으로 가는 길을 함께 보여 준다(2026-10-01)
  if (!loggedIn) return <>{guest.length > 0 && <Link href="/saved" className="auth-saved">저장<span className="cnt">{guest.length}</span></Link>}<Link href="/login">로그인</Link></>;

  return (
    <>
      {expert === "approved" && <Link href="/expert" title="전문가 페어링 검수">검수</Link>}
      <Link href="/my">마이{user?.name && <span className="nick"> · {user.name}</span>}</Link>
    </>
  );
}
