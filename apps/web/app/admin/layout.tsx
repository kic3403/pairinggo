import type { ReactNode } from "react";
import Link from "next/link";
import { adminEnabled, isAdmin } from "@/lib/admin-auth";
import "./admin.css";

export const dynamic = "force-dynamic";

/** 운영 어드민 셸 — 인증 가드는 각 페이지의 requireAdmin()·API의 isAdmin()이 담당 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!adminEnabled()) {
    return <main className="adm"><div className="card"><b>어드민이 꺼져 있어요.</b><p className="muted">apps/web/.env.local 에 <code>ADMIN_PASSWORD</code>를 설정하고 서버를 재시작하세요.</p></div></main>;
  }
  const ok = await isAdmin();
  return (
    <main className="adm">
      {ok && (
        <nav className="adm-nav">
          <b>페어링<span style={{ color: "var(--food)" }}>GO</span> 운영</b>
          <Link href="/admin">대시보드</Link>
          <Link href="/admin/review">검수</Link>
          <Link href="/admin/publish">발행</Link>
          <Link href="/admin/picks">회원 추천</Link>
          <Link href="/admin/places">식당 정보</Link>
          <Link href="/admin/partners">파트너</Link>
          <Link href="/admin/place-reviews">식당 리뷰</Link>
          <Link href="/admin/drinks">술 정보</Link>
          <Link href="/admin/shop">구매</Link>
          <Link href="/admin/wanted">없는 술</Link>
          <Link href="/admin/errors">오류</Link>
          <a href="/admin/api/logout">로그아웃</a>
        </nav>
      )}
      {children}
    </main>
  );
}
