/**
 * 홈 아이콘 메뉴 — 4열 × 3줄 입체 일러스트(2026-10-03 UI 리뉴얼, 시안 캔버스 그대로). 기능이 늘 때마다 여기에 한 칸씩.
 * 그림은 quick-icons.ts(SVG 문자열, 외부 이미지·상표 로고 없음). 연도가 들어가는 항목(미쉐린)은 데이터의 최신 연도를 받아 표시한다.
 * 해외직구·공동구매는 사용자 요청(2026-10-03)으로 자리만 — 기능 전이라 '준비 중'(링크 없음). 주류 통신판매 규정 검토 뒤 연다.
 */
import Link from "next/link";
import { QUICK_ICONS } from "./quick-icons";

type Item = { href?: string; label: string; icon: keyof typeof QUICK_ICONS; bg: string; badge?: string; soon?: boolean };

export default function QuickMenu({ michelinYear }: { michelinYear: number | null }) {
  const items: Item[] = [
    { href: "/drinks", label: "술로 찾기", icon: "drink", bg: "linear-gradient(160deg, #FFF4EE, #F9DED2)" },
    { href: "/foods", label: "음식으로 찾기", icon: "food", bg: "linear-gradient(160deg, #F2F6FC, #DCE6F5)" },
    { href: "/places", label: "식당 예약", icon: "reserve", bg: "linear-gradient(160deg, #EEF8F1, #D5EBDB)" },
    { href: "/places?kind=brewery", label: "양조장 방문", icon: "brewery", bg: "linear-gradient(160deg, #FFF2EA, #F6D9C6)" },
    { href: "/today", label: "오늘의 페어링", icon: "today", bg: "linear-gradient(160deg, #FFF9EA, #FBE8BE)" },
    { href: "/awards?c=fair", label: "수상 전통주", icon: "award", bg: "linear-gradient(160deg, #FFF7E3, #F6E2AE)" },
    { href: "/michelin", label: michelinYear ? `${michelinYear} 미쉐린` : "미쉐린", icon: "michelin", bg: "linear-gradient(160deg, #FFF0EF, #F8D3D1)" },
    { href: "/hot", label: "핫한 페어링", icon: "hot", bg: "linear-gradient(160deg, #FFF3EA, #FBD8C2)", badge: "N" },
    { href: "/weekly", label: "주간 TOP5", icon: "top5", bg: "linear-gradient(160deg, #F2F6FC, #DCE6F5)" },
    { href: "/guide", label: "페어링 모음", icon: "guide", bg: "linear-gradient(160deg, #F7F7F7, #E6E6E6)" },
    { label: "해외직구", icon: "overseas", bg: "linear-gradient(160deg, #EDF6FC, #CFE4F3)", soon: true },
    { label: "공동구매", icon: "group", bg: "linear-gradient(160deg, #FFF9EA, #FBE8BE)", soon: true },
  ];
  const tile = (it: Item) => (
    <>
      <span className="ic" style={{ background: it.bg }} aria-hidden>
        <span className="ic-img" dangerouslySetInnerHTML={{ __html: QUICK_ICONS[it.icon] }} />
        {it.badge && <em>{it.badge}</em>}
        {it.soon && <em className="soon">준비 중</em>}
      </span>
      <span className="lb">{it.label}</span>
    </>
  );
  return (
    <nav className="quick quick-v2" aria-label="바로가기">
      <ul>
        {items.map((it) => (
          <li key={it.label}>
            {it.href ? <Link href={it.href}>{tile(it)}</Link> : <span className="soon-tile" aria-disabled="true" title="준비 중">{tile(it)}</span>}
          </li>
        ))}
      </ul>
    </nav>
  );
}
