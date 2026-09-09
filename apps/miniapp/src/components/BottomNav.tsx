import { Link, useLocation } from "react-router";

const ITEMS = [
  { to: "/", label: "홈", match: (p: string) => p === "/", icon: <><path d="M3 10.5 12 3l9 7.5V21H3z" /><path d="M9 21v-6h6v6" /></> },
  { to: "/search", label: "검색", match: (p: string) => p.startsWith("/search") || p.startsWith("/browse"), icon: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></> },
  { to: "/related", label: "추천", match: (p: string) => p.startsWith("/related"), icon: <><path d="M4 19V5" /><path d="M4 12h9l-3-3" /><path d="M13 12l-3 3" /><path d="M16 5h4v4" /><path d="M20 5l-5 5" /></> },
  { to: "/saved", label: "저장", match: (p: string) => p.startsWith("/saved"), icon: <path d="M12 21s-7.5-4.8-9.5-9C.9 8.6 2.9 5 6.5 5c2.2 0 3.7 1.2 5.5 3 1.8-1.8 3.3-3 5.5-3 3.6 0 5.6 3.6 4 7-2 4.2-9.5 9-9.5 9z" /> },
  { to: "/my", label: "마이", match: (p: string) => p.startsWith("/my"), icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></> },
];

/** 하단 탭 5개 — 홈 · 검색 · 추천 · 저장 · 마이 (앱인토스 탭바 규격: 하단 고정, 토스 메인 탭과 겹치지 않는 형태) */
export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-surface border-t border-line flex px-2 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] z-30" aria-label="주요 메뉴">
      {ITEMS.map((it) => {
        const on = it.match(pathname);
        return (
          <Link key={it.label} to={it.to} aria-current={on ? "page" : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-1.5 text-[10px] tracking-wide ${on ? "text-ink font-semibold" : "text-muted"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{it.icon}</svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
