/** 파트너 매장 줄(데일리샷의 브랜드 로고 캐러셀식, 2026-09-25) — 승인 파트너의 대표 사진 동그라미 → 매장 상세. 사진 없는 곳은 업종 색 원에 이름 */
import Link from "next/link";
import { PARTNER_KIND_LABEL, type PartnerKind } from "@pairinggo/shared";

export type PartnerRowItem = { id: string; name: string; kind: PartnerKind; kakaoId: string; photo: string | null };
const TONE: Record<PartnerKind, string> = { brewery: "#8A5A00", restaurant: "#22406B", liquor: "#5B6B8A" };

export default function PartnerRow({ items }: { items: PartnerRowItem[] }) {
  if (!items.length) return null;
  return (
    <section className="prow">
      <div className="section-head"><h2>페어링GO 파트너</h2><Link href="/places">매장 찾기</Link></div>
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/places/${p.kakaoId}?n=${encodeURIComponent(p.name)}`}>
              <span className="pr-circle" style={{ ["--tone" as string]: TONE[p.kind] }}>{p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <span>{p.name.slice(0, 4)}</span>}</span>
              <span className="pr-name">{p.name}</span>
              <span className="pr-kind">{PARTNER_KIND_LABEL[p.kind]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
