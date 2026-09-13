/**
 * 홈 아이콘 메뉴 — 캐치테이블식. 기능이 늘 때마다 여기에 한 칸씩 더한다.
 * 아이콘은 이모지(외부 이미지·상표 로고 없음). 연도가 들어가는 항목(미쉐린)은 데이터의 최신 연도를 받아 표시한다.
 */
import Link from "next/link";

type Item = { href: string; label: string; icon: string; tone: string; badge?: string };

export default function QuickMenu({ michelinYear }: { michelinYear: number | null }) {
  const items: Item[] = [
    { href: "/michelin", label: michelinYear ? `${michelinYear} 미쉐린` : "미쉐린", icon: "★", tone: "#B3261E" },
    { href: "/awards", label: "우리술품평회", icon: "🏆", tone: "#C9880A" },
    { href: "/hot", label: "핫한 페어링", icon: "🔥", tone: "#E4572E", badge: "N" },
    { href: "/drinks", label: "전통주", icon: "🍶", tone: "#22406B" },
    { href: "/foods", label: "음식·안주", icon: "🍢", tone: "#6E9B6A" },
    { href: "/search", label: "상황 검색", icon: "🔎", tone: "#5B8DB8" },
    { href: "/picks", label: "회원 추천", icon: "🙌", tone: "#3D4A9E" },   // 2026-09-13 회원 추천 페어링(사용자 결정) — '수도권 술' 칸을 대신(지역은 관심지역 줄에서)
    { href: "/my", label: "저장·마이", icon: "♥", tone: "#C77D5A" },
  ];
  return (
    <nav className="quick" aria-label="바로가기">
      <ul>
        {items.map((it) => (
          <li key={it.href}>
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
