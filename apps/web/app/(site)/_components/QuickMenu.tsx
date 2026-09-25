/**
 * 홈 아이콘 메뉴 — 캐치테이블식 5열 × 2줄(2026-09-25 재구성). 기능이 늘 때마다 여기에 한 칸씩.
 * 아이콘은 이모지(외부 이미지·상표 로고 없음). 연도가 들어가는 항목(미쉐린)은 데이터의 최신 연도를 받아 표시한다.
 * 술·음식 목록은 서비스 타일(FlowTiles)에 있어 여기서는 뺐다.
 */
import Link from "next/link";

type Item = { href: string; label: string; icon: string; tone: string; badge?: string };

export default function QuickMenu({ michelinYear }: { michelinYear: number | null }) {
  const items: Item[] = [
    { href: "/hot", label: "오늘의 페어링", icon: "🍶", tone: "#E4572E" },
    { href: "/search", label: "상황 검색", icon: "🔎", tone: "#5B8DB8" },
    { href: "/drinks/categories", label: "카테고리", icon: "🗂️", tone: "#5B6B8A" },
    { href: "/michelin", label: michelinYear ? `${michelinYear} 미쉐린` : "미쉐린", icon: "★", tone: "#B3261E" },
    { href: "/awards?c=fair", label: "우리술품평회", icon: "🏆", tone: "#C9880A" },   // 2026-09-24 사용자 요청: 대회별로 한 칸씩
    { href: "/awards?c=kla", label: "주류대상", icon: "🥇", tone: "#8A5A00" },
    { href: "/hot", label: "핫한 페어링", icon: "🔥", tone: "#C23B22", badge: "N" },
    { href: "/picks", label: "회원 추천", icon: "🙌", tone: "#3D4A9E" },   // 2026-09-13 회원 추천 페어링(사용자 결정)
    { href: "/places", label: "내 주변 매장", icon: "📍", tone: "#2F6B3A" },
    { href: "/my", label: "저장·마이", icon: "♥", tone: "#C77D5A" },
  ];
  return (
    <nav className="quick" aria-label="바로가기">
      <ul>
        {items.map((it) => (
          <li key={it.href + it.label}>
            <Link href={it.href}>
              <span className="ic" style={{ ["--tone" as string]: it.tone }} aria-hidden>{it.icon}{it.badge && <em>{it.badge}</em>}</span>
              <span className="lb">{it.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
