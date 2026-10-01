/**
 * 사이트 전체의 없는 화면(2026-10-02) — 어느 화면에도 맞지 않는 주소, 그리고 프록시가 404로 답한 없는 술·음식·모음 주소(운영 배포에서는
 * `(site)/not-found.tsx`가 아니라 이 파일이 쓰인다 — 배포 뒤 실측). 전에는 Next.js 기본 영어 문구("This page could not be found")가 떴다.
 * 루트 레이아웃에는 헤더·site.css가 없으므로 색·간격을 여기서 직접 정한다(로고 색 남색·주황, 라이트 고정).
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "찾을 수 없는 화면 | 페어링GO", robots: { index: false } };

const NAVY = "#22406B", FOOD = "#E4572E", INK = "#1F1E1C", MUTED = "#6B6963", LINE = "#E6E3DC";
const btn = { display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 18px", borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", color: INK, fontSize: 15, fontWeight: 700, textDecoration: "none" } as const;

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7", color: INK }}>
      <header style={{ borderBottom: `1px solid ${LINE}`, background: "#fff" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 16px" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK, fontSize: 20, fontWeight: 800 }} aria-label="페어링GO 홈">
            <span style={{ display: "inline-flex" }} aria-hidden>
              <span style={{ width: 20, height: 20, borderRadius: 10, background: NAVY }} />
              <span style={{ width: 20, height: 20, borderRadius: 10, background: FOOD, marginLeft: -7, opacity: 0.92 }} />
            </span>
            <span>페어링<span style={{ color: FOOD }}>GO</span></span>
          </Link>
        </div>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 16px 60px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, letterSpacing: "-0.02em" }}>찾을 수 없는 화면이에요</h1>
        <p style={{ margin: "0 0 20px", fontSize: 16, lineHeight: 1.6, color: MUTED }}>주소가 바뀌었거나 아직 등록되지 않은 술·음식일 수 있어요. 이름으로 다시 찾아보세요.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/search" style={{ ...btn, background: NAVY, borderColor: NAVY, color: "#fff" }}>이름으로 검색</Link>
          <Link href="/drinks" style={btn}>주류 목록</Link>
          <Link href="/foods" style={btn}>음식 목록</Link>
          <Link href="/guide" style={btn}>종류별 페어링 모음</Link>
          <Link href="/" style={btn}>홈으로</Link>
        </div>
        <p style={{ margin: "18px 0 0", fontSize: 13.5, color: MUTED }}>찾는 술이 없으면 검색 화면에서 추가를 요청할 수 있어요.</p>
      </main>
    </div>
  );
}
