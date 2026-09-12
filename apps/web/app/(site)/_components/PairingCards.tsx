/** 페어링 카드 목록 — 술 상세(어울리는 음식)와 음식 상세(어울리는 전통주)가 함께 쓴다. */
import Link from "next/link";
import CardLink from "./CardLink";
import ExtLink from "./ExtLink";
import GradeBadge from "./GradeBadge";
import { SRC_LABEL, toSlug, type Grade, type Pairing, type SrcTier } from "@pairinggo/shared";

export type CardItem = {
  href: string;
  name: string;
  sub?: string;
  /** 등급(찰떡·잘 어울림·시도해 볼 만)과 툴팁용 설명 — 숫자 점수는 화면에 크게 쓰지 않는다 */
  grade: Grade;
  explain: string;
  pairing: Pairing;
};

/** 근거가 붙은 추천인지 — 맛 프로필 계산(profile)과 구분해 표시한다 */
const hasEvidence = (src: SrcTier | undefined, ev: Pairing["ev"]) => !!ev?.url || (src !== undefined && src !== "profile" && src !== "ai");

export function PairingCards({ items }: { items: CardItem[] }) {
  if (!items.length) return <p className="muted">아직 등록된 페어링이 없습니다.</p>;
  return (
    <ul className="cards">
      {items.map(({ href, name, sub, grade, explain, pairing: p }) => (
        <li key={href} className="card">
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
            <span className={`badge${p.src === "official" || p.src === "sommelier" ? " o" : ""}`}>{SRC_LABEL[p.src ?? "profile"]}</span>
            {hasEvidence(p.src, p.ev)
              ? (p.ev?.url
                ? <ExtLink href={p.ev.url} event="external_link" props={{ d: p.d, f: p.f, kind: "evidence" }}>{p.ev.source || "출처 보기"} ↗</ExtLink>
                : <span>{p.ev?.source || "전문가 추천"}</span>)
              : <span>맛 프로필로 계산한 추정</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export const drinkHref = (name: string) => `/drinks/${toSlug(name)}`;
export const foodHref = (name: string) => `/foods/${toSlug(name)}`;
