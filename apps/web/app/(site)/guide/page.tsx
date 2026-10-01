/** 페어링 모음 목록(2026-10-01) — 종류별 모음 화면(/guide/[slug])으로 가는 입구. 규칙은 shared seo/guides.ts */
import type { Metadata } from "next";
import Link from "next/link";
import { guideList } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "페어링 모음 — 술 종류별 안주, 음식 종류별 어울리는 술 | 페어링GO",
  description: "막걸리 안주, 약주 안주, 전·회·구이에 어울리는 술처럼 종류별로 근거가 확인된 페어링을 모았습니다.",
  alternates: { canonical: "/guide" },
};

export default async function GuideIndex() {
  const c = await getCatalog();
  const list = guideList(c.dataset);
  const drinks = list.filter((g) => g.side === "drink"), foods = list.filter((g) => g.side === "food");
  return (
    <div className="wrap guide">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>페어링 모음</h1>
      <p className="lead">종류별로 근거가 확인된 조합만 모았어요. 술 이름이나 음식 이름을 알면 검색이 더 빠릅니다.</p>
      <h2>술 종류별 안주</h2>
      <ul className="guide-links">{drinks.map((g) => <li key={g.slug}><Link href={`/guide/${g.slug}`}>{g.h1}<span className="small muted"> · 근거 조합 {g.n}</span></Link></li>)}</ul>
      <h2 style={{ marginTop: 22 }}>음식 종류별 어울리는 술</h2>
      <ul className="guide-links">{foods.map((g) => <li key={g.slug}><Link href={`/guide/${g.slug}`}>{g.h1}<span className="small muted"> · 근거 조합 {g.n}</span></Link></li>)}</ul>
    </div>
  );
}
