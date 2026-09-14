"use client";
/**
 * 휴대폰 하단 탭바 — 홈 · 검색 · 전통주 · 음식 · 마이(2026-09-14, 캐치테이블·데일리샷 앱 구조 참고, docs/19 §5).
 * 767px 이하에서만 보이고(CSS), 그때 헤더 메뉴는 숨긴다. 술·음식 상세에서는 탭바 대신 하단 고정 버튼(DetailActionBar)을 쓴다.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaved } from "./SavedProvider";

const ICON: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
  drink: <path d="M10 3h4v3.2c0 .8.4 1.5 1 2 1.3 1 2 2.4 2 4V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7.8c0-1.6.7-3 2-4 .6-.5 1-1.2 1-2zM7 14h10" />,
  food: <path d="M3.5 12h17a8.5 8.5 0 0 1-17 0zM8 8.5c0-1.5 1-2 1-3.5M12 8.5c0-1.5 1-2 1-3.5M16 8.5c0-1.5 1-2 1-3.5" />,
  me: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>,
};

/** 탭바를 숨기는 화면 — 상세(하단 고정 버튼이 대신), 로그인·가입 흐름(폼 버튼이 가려지지 않게) */
export const hidesTabBar = (path: string) => /^\/(drinks|foods)\/[^/]+/.test(path) || /^\/(login|signup|profile|withdraw)(\/|$)/.test(path);

export default function MobileTabBar() {
  const path = usePathname() || "/";
  const { ready, loggedIn } = useSaved();
  if (hidesTabBar(path)) return null;
  const tabs = [
    { href: "/", label: "홈", icon: "home", on: path === "/" },
    { href: "/search", label: "검색", icon: "search", on: path.startsWith("/search") },
    { href: "/drinks", label: "전통주", icon: "drink", on: path.startsWith("/drinks") },
    { href: "/foods", label: "음식", icon: "food", on: path.startsWith("/foods") },
    { href: ready && !loggedIn ? "/login" : "/my", label: ready && !loggedIn ? "로그인" : "마이", icon: "me", on: /^\/(my|saved|picks)(\/|$)/.test(path) },
  ];
  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={t.on ? "on" : undefined} aria-current={t.on ? "page" : undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[t.icon]}</svg>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
