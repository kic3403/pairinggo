/**
 * 페어링GO 파트너 — 사진 카드 2열(2026-10-03 UI 리뉴얼, 캐치테이블 "좋아할 맛집" 카드식). 승인 파트너의 대표 사진 → 매장 상세.
 * 사진 없는 곳은 업종 색 타일에 이름 첫 글자. 왼쪽 위 업종 배지(양조장 주황·식당 남색·리쿼샵 회색 — 파트너 도장 색 규칙).
 */
import Link from "next/link";
import { PARTNER_KIND_LABEL, type PartnerKind } from "@pairinggo/shared";

export type PartnerRowItem = { id: string; name: string; kind: PartnerKind; kakaoId: string; photo: string | null; intro?: string | null };
const TONE: Record<PartnerKind, string> = { brewery: "linear-gradient(160deg, #F6D9C6, #B8742E)", restaurant: "linear-gradient(160deg, #D9E2EE, #22406B)", liquor: "linear-gradient(160deg, #E6E6E6, #5B6B8A)" };
const BADGE: Record<PartnerKind, string> = { brewery: "#C7471F", restaurant: "#22406B", liquor: "#5B6B8A" };

export default function PartnerRow({ items, title = "페어링GO 파트너" }: { items: PartnerRowItem[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="prow prow-v2">
      <div className="section-head"><h2>{title}</h2><Link href="/places">전체보기 ›</Link></div>
      <ul>
        {items.slice(0, 4).map((p) => (
          <li key={p.id}>
            <Link href={`/places/${p.kakaoId}?n=${encodeURIComponent(p.name)}`}>
              <span className="pc-img" style={p.photo ? undefined : { background: TONE[p.kind] }}>
                {p.photo ? <img src={p.photo} alt="" loading="lazy" decoding="async" /> : <span className="pc-initial" aria-hidden>{p.name.slice(0, 1)}</span>}
                <span className="pc-kind" style={{ background: BADGE[p.kind] }}>{PARTNER_KIND_LABEL[p.kind]}</span>
              </span>
              <b className="pc-name">{p.name}</b>
              {p.intro && <span className="pc-sub">{p.intro}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
