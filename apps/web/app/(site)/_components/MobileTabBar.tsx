"use client";
/**
 * 휴대폰 하단 탭바 — 떠 있는 알약(2026-10-03 UI 리뉴얼, 캐치테이블식): 홈 · 저장 · 내 주변 · 예약·주문 · MY.
 * 767px 이하에서만 보이고(CSS), 그때 헤더 메뉴는 숨긴다. 술·음식 상세에서는 탭바 대신 하단 고정 버튼(DetailActionBar)을 쓴다.
 * 검색은 헤더 검색창, 주류·음식 목록은 홈 탭·아이콘 메뉴가 맡는다.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaved } from "./SavedProvider";

const ICON: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />,
  saved: <path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" />,
  near: <><path d="M12 22s7-7.4 7-12a7 7 0 1 0-14 0c0 4.6 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  book: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  me: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>,
};

/** 탭바를 숨기는 화면 — 상세(하단 고정 버튼이 대신), 로그인·가입 흐름(폼 버튼이 가려지지 않게) */
export const hidesTabBar = (path: string) => /^\/(drinks|foods)\/[^/]+/.test(path) || /^\/(login|signup|profile|withdraw)(\/|$)/.test(path);

export default function MobileTabBar() {
  const path = usePathname() || "/";
  const { ready, loggedIn, guest } = useSaved();
  if (hidesTabBar(path)) return null;
  const savedHref = loggedIn ? "/my" : guest.length ? "/saved" : "/login?next=%2Fmy";
  const tabs = [
    { href: "/", label: "홈", icon: "home", on: path === "/" },
    { href: savedHref, label: "저장", icon: "saved", on: /^\/(saved)(\/|$)/.test(path) },
    { href: "/places", label: "내 주변", icon: "near", on: path.startsWith("/places") },
    { href: loggedIn ? "/my/reservations" : "/login?next=%2Fmy%2Freservations", label: "예약·주문", icon: "book", on: /^\/(my\/reservations|orders|reserve)(\/|$)/.test(path) },
    { href: ready && !loggedIn ? "/login" : "/my", label: ready && !loggedIn ? "로그인" : "MY", icon: "me", on: /^\/(my|picks|login)(\/|$)/.test(path) && !/^\/my\/reservations/.test(path) },
  ];
  return (
    <nav className="tabbar tabbar-v2" aria-label="하단 메뉴">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={t.on ? "on" : undefined} aria-current={t.on ? "page" : undefined}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill={t.on && t.icon === "home" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[t.icon]}</svg>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
