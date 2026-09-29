import type { ReactNode } from "react";
import AdminNav from "./AdminNav";
import { adminBadges } from "@/lib/admin-badges";
import { adminEnabled, isAdmin } from "@/lib/admin-auth";
import "./admin.css";

export const dynamic = "force-dynamic";

/** 운영 어드민 셸 — 인증 가드는 각 페이지의 requireAdmin()·API의 isAdmin()이 담당 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!adminEnabled()) {
    return <main className="adm"><div className="card"><b>어드민이 꺼져 있어요.</b><p className="muted">apps/web/.env.local 에 <code>ADMIN_PASSWORD</code>를 설정하고 서버를 재시작하세요.</p></div></main>;
  }
  const ok = await isAdmin();
  if (!ok) return <main className="adm">{children}</main>;
  const badges = await adminBadges().catch(() => ({}));
  return (
    <div className="adm-shell">
      <AdminNav badges={badges} />
      <main className="adm">{children}</main>
    </div>
  );
}
