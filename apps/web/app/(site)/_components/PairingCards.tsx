/** 페어링 카드 목록 — 술 상세(어울리는 음식)와 음식 상세(어울리는 전통주)가 함께 쓴다. */
import Link from "next/link";
import CardLink from "./CardLink";
import ExtLink from "./ExtLink";
import GradeBadge from "./GradeBadge";
import TriedRating from "./TriedRating";
import { PICK_DETAIL, PICK_LABEL, pickOf, toSlug, type Grade, type Pairing, type PickKey } from "@pairinggo/shared";

export type CardItem = {
  href: string;
  name: string;
  sub?: string;
  /** 등급(찰떡·잘 어울림·시도해 볼 만)과 툴팁용 설명 — 숫자 점수는 화면에 크게 쓰지 않는다 */
  grade: Grade;
  explain: string;
  pairing: Pairing;
};

/** 묶음(전문가픽·대중픽·맛 분석)별 카드 수 — 탭 숫자용 */
export function pickCounts(items: CardItem[]): Record<PickKey, number> {
  const c: Record<PickKey, number> = { expert: 0, public: 0, profile: 0 };
  for (const it of items) c[pickOf(it.pairing.src)]++;
  return c;
}

export function PairingCards({ items }: { items: CardItem[] }) {
  if (!items.length) return <p className="muted">아직 등록된 페어링이 없습니다.</p>;
  return (
    <ul className="cards">
      {items.map(({ href, name, sub, grade, explain, pairing: p }) => {
        const pick = pickOf(p.src);
        return (
          <li key={href} className="card" data-pick={pick}>
            <div className="top">
              <CardLink href={href} d={p.d} f={p.f} from={href.startsWith("/foods") ? "drink" : "food"} className="name">{name}</CardLink>
              <GradeBadge grade={grade} title={explain} />
            </div>
            {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
            {p.reason && <p className="why">{p.reason}</p>}
            {p.ev?.quote && (
              <blockquote className="quote">
                “{p.ev.quote}”
                {p.ev.who && <span className="muted"> — {p.ev.who}</span>}
              </blockquote>
            )}
            <div className="src">
              <span className={`pick ${pick}`}>{PICK_LABEL[pick]}</span>
              <span className="muted">{PICK_DETAIL[p.src ?? "profile"]}</span>
              {p.ev?.url
                ? <ExtLink href={p.ev.url} event="external_link" props={{ d: p.d, f: p.f, kind: "evidence" }}>{p.ev.source || "출처 보기"} ↗</ExtLink>
                : pick !== "profile" && p.ev?.source ? <span>{p.ev.source}</span> : null}
            </div>
            <TriedRating d={p.d} f={p.f} />
          </li>
        );
      })}
    </ul>
  );
}

export const drinkHref = (name: string) => `/drinks/${toSlug(name)}`;
export const foodHref = (name: string) => `/foods/${toSlug(name)}`;
