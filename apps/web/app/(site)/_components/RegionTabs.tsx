/**
 * 지역 칩 2단 — 1단은 상위 지역(전국·수도권·부산…), 수도권(또는 그 하위)을 고르면 2단에 서울·인천·경기도.
 * 검색 페이지와 전통주 목록이 같이 쓴다. href는 호출부가 만든다(검색어·종류 필터를 유지해야 하므로).
 */
import Link from "next/link";
import { REGION_TREE, TOP_REGIONS, regionById, topOf } from "@pairinggo/shared";

export default function RegionTabs({ current, href }: { current?: string | null; href: (id: string) => string }) {
  const cur = regionById(current);
  const top = topOf(cur);
  const subs = REGION_TREE[top] ?? [];
  return (
    <nav aria-label="지역" className="region-nav">
      <ul className="tabs region-tabs">
        {TOP_REGIONS.map((r) => <li key={r.id}><Link href={href(r.id)} className={r.id === top ? "on" : undefined}>{r.label}</Link></li>)}
      </ul>
      {subs.length > 0 && (
        <ul className="tabs region-tabs sub" aria-label={`${TOP_REGIONS.find((r) => r.id === top)?.label} 세부`}>
          <li><Link href={href(top)} className={cur?.id === top ? "on" : undefined}>전체</Link></li>
          {subs.map((s) => <li key={s.id}><Link href={href(s.id)} className={cur?.id === s.id ? "on" : undefined}>{s.label}</Link></li>)}
        </ul>
      )}
    </nav>
  );
}
