/**
 * 없는 화면 안내(2026-10-02) — 없는 술·음식·모음 주소로 들어왔을 때. 전에는 Next.js 기본 영어 문구("This page could not be found")가 떴다.
 * 상태 코드 404는 proxy.ts가 낸다(화면 사이 뼈대 때문에 페이지의 notFound()만으로는 200으로 답했다).
 * 이름이 바뀌었거나 아직 없는 술일 수 있으니 검색·목록·추가 요청으로 잇는다.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "찾을 수 없는 화면 | 페어링GO", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="wrap">
      <h1>찾을 수 없는 화면이에요</h1>
      <p className="lead">주소가 바뀌었거나 아직 등록되지 않은 술·음식일 수 있어요. 이름으로 다시 찾아보세요.</p>
      <div className="btns">
        <Link className="btn p" href="/search">이름으로 검색</Link>
        <Link className="btn" href="/drinks">주류 목록</Link>
        <Link className="btn" href="/foods">음식 목록</Link>
        <Link className="btn" href="/">홈으로</Link>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>찾는 술이 없으면 검색 화면에서 추가를 요청할 수 있어요. <Link href="/guide">종류별 페어링 모음</Link>도 있습니다.</p>
    </div>
  );
}
