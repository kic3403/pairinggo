/**
 * 홈 위 2단 탭(캐치테이블·데일리샷식, 2026-09-25) — 홈 · 전통주 · 위스키 · 사케 · 와인 · 음식 · 수상 · 핫한 페어링. 가로 스크롤, 밑줄. 홈에서만.
 */
import Link from "next/link";
import { HOME_TABS } from "@pairinggo/shared";

export default function HomeTabs() {
  return (
    <nav className="home-tabs" aria-label="둘러보기">
      <ul className="cat-tabs kind-tabs">
        {HOME_TABS.map((t, i) => (
          <li key={t.href}><Link href={t.href} className={i === 0 ? "on" : undefined} aria-current={i === 0 ? "page" : undefined}>{t.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
