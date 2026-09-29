"use client";
/**
 * 어드민 메뉴(2026-09-29 사용자 요청 — 글자가 세로로 쪼개져 보기 불편) — 넓은 화면은 왼쪽 묶음 메뉴, 좁은 화면은 한 줄 가로 스크롤.
 * 지금 보고 있는 화면을 표시한다. 새 어드민 화면은 GROUPS에 한 줄씩 넣는다.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminBadges } from "@/lib/admin-badges";

const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  { title: "", items: [{ href: "/admin", label: "대시보드" }] },
  { title: "페어링 데이터", items: [
    { href: "/admin/review", label: "근거 검수" }, { href: "/admin/publish", label: "발행" }, { href: "/admin/drinks", label: "술 정보" },
    { href: "/admin/foods", label: "음식 사진" }, { href: "/admin/wanted", label: "없는 술" },
  ] },
  { title: "회원", items: [{ href: "/admin/picks", label: "회원 추천" }, { href: "/admin/drink-reviews", label: "술 평가" }, { href: "/admin/experts", label: "전문가 등급" }] },
  { title: "매장", items: [
    { href: "/admin/partners", label: "파트너" }, { href: "/admin/places", label: "식당 정보" }, { href: "/admin/place-reviews", label: "식당 리뷰" }, { href: "/admin/shop", label: "구매" },
  ] },
  { title: "사이트", items: [{ href: "/admin/banners", label: "홈 배너" }, { href: "/admin/notices", label: "공지" }, { href: "/admin/errors", label: "오류" }] },
];

export default function AdminNav({ badges = {} }: { badges?: AdminBadges }) {
  const path = usePathname() || "/admin";
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <aside className="adm-side">
      <div className="adm-brand">
        <Link href="/admin">페어링<span style={{ color: "var(--food)" }}>GO</span> 운영</Link>
        <a className="adm-logout" href="/admin/api/logout">로그아웃</a>
      </div>
      <nav className="adm-menu" aria-label="운영 메뉴">
        {GROUPS.map((g) => (
          <div key={g.title || "home"} className="adm-group">
            {g.title && (
              <span className="adm-group-title">
                {g.title}
                {/* 묶음 안 알림 합계 — 좁은 화면에서는 묶음 제목이 숨으므로 항목 숫자만 */}
                {(() => { const n = g.items.reduce((s, it) => s + (badges[it.href]?.n ?? 0), 0); return n ? <i className="adm-dot" aria-hidden /> : null; })()}
              </span>
            )}
            {g.items.map((it) => {
              const b = badges[it.href];
              return (
                <Link key={it.href} href={it.href} className={`${g.title ? "sub" : "top"}${on(it.href) ? " on" : ""}`} aria-current={on(it.href) ? "page" : undefined} title={b?.title}>
                  <span>{it.label}</span>
                  {b && <span className="adm-badge" aria-label={b.title}>{b.n > 99 ? "99+" : b.n}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
