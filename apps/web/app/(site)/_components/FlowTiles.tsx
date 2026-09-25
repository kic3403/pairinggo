/** 서비스 타일 4장(데일리샷식, 2026-09-25) — 술로 찾기 · 음식으로 찾기 · 식당 예약 · 양조장 방문. 색은 배너와 같은 tone 토큰 */
import Link from "next/link";
import { FLOW_TILES } from "@pairinggo/shared";

export default function FlowTiles() {
  return (
    <nav className="flow" aria-label="이용 방법">
      <ul>
        {FLOW_TILES.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className={`flow-tile tone-${t.tone}`}>
              <span className="ic" aria-hidden>{t.icon}</span>
              <b>{t.title}</b>
              <span className="sub">{t.sub}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
