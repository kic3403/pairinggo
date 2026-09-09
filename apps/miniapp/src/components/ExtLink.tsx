import type { ReactNode } from "react";
import { openExternal, type ExternalKind } from "@/lib/openExternal";

/**
 * 외부 링크 버튼 — <a target=_blank> 대신 사용 (CLAUDE.md 절대 규칙).
 * 토스 앱 안에서는 기기 브라우저로 열리고, 일반 브라우저에서는 새 탭.
 */
export default function ExtLink({ href, kind = "other", className, children, meta, title }:
  { href: string; kind?: ExternalKind; className?: string; children: ReactNode; meta?: Record<string, string | number>; title?: string }) {
  return (
    <a href={href} className={className} title={title} rel="noopener"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openExternal(href, kind, meta); }}>
      {children}
    </a>
  );
}
