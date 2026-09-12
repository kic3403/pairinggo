/**
 * 공개 웹(검색 유입용) 공통 레이아웃 — 헤더·푸터·법적 고지.
 * 미니앱(모바일 고정 폭)과 달리 데스크톱까지 대응하는 반응형이다. 데이터·검색 로직은 packages/shared를 공유한다.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import AuthNav from "./_components/AuthNav";
import PageView from "./_components/PageView";
import RegionBar from "./_components/RegionBar";
import RegionProvider from "./_components/RegionProvider";
import RegionSheet from "./_components/RegionSheet";
import SavedProvider from "./_components/SavedProvider";
import SearchBox from "./_components/SearchBox";
import "./site.css";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <SavedProvider>
    <RegionProvider>
      <header className="site-head">
        <div className="wrap">
          <Link href="/" className="brand" aria-label="페어링GO 홈">
            <span className="dots" aria-hidden><i /><i /></span>
            <span>페어링<span style={{ color: "var(--food)" }}>GO</span></span>
          </Link>
          <SearchBox compact />
          <nav className="site-nav" aria-label="주요 메뉴">
            <Link href="/search" className="search-link">검색</Link>
            <Link href="/drinks">전통주</Link>
            <Link href="/foods">음식·안주</Link>
            <AuthNav />
          </nav>
        </div>
      </header>
      {/* useSearchParams를 쓰는 클라이언트 컴포넌트는 정적 생성 시 Suspense 경계가 필요하다 */}
      <Suspense fallback={<div className="region-bar" aria-hidden />}><RegionBar /></Suspense>
      <Suspense fallback={null}><RegionSheet /></Suspense>
      <PageView />

      <main>{children}</main>

      <footer className="site-foot">
        <div className="wrap">
          <nav aria-label="푸터 메뉴">
            <Link href="/drinks">전통주 전체</Link>
            <Link href="/foods">음식 전체</Link>
          </nav>
          <p>페어링GO는 전통주와 음식의 어울림을 양조장·소믈리에·전문 매체의 근거와 함께 제안합니다. 술을 직접 판매하지 않으며, 구매는 각 양조장·판매처 페이지에서 이루어집니다.</p>
          <p className="warn">
            주류는 만 19세 이상만 구매할 수 있습니다. 지나친 음주는 뇌졸중, 기억력 손상이나 치매를 유발합니다.
            임신 중 음주는 기형아 출생 위험을 높입니다.
          </p>
        </div>
      </footer>
    </RegionProvider>
    </SavedProvider>
  );
}
