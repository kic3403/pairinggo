"use client";
/**
 * 헤더 로그인 상태 — 세션은 SavedProvider가 한 번만 받아 둔 것을 쓴다.
 * 서버 컴포넌트에서 auth()를 부르면 모든 공개 페이지가 동적 렌더로 바뀌어 검색 유입용 정적 생성이 깨진다.
 */
import Link from "next/link";
import { useSaved } from "./SavedProvider";

export default function AuthNav() {
  const { ready, loggedIn, user } = useSaved();

  // 확인 전에는 자리만 잡아 둔다 (레이아웃이 흔들리지 않게)
  if (!ready) return <span style={{ width: 52 }} aria-hidden />;
  if (!loggedIn) return <Link href="/login">로그인</Link>;

  return <Link href="/my">마이{user?.name ? ` · ${user.name}` : ""}</Link>;
}
