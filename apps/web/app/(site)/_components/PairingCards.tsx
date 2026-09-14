/**
 * 페어링 카드 목록 — 술 상세(어울리는 음식)와 음식 상세(어울리는 전통주)가 함께 쓴다.
 * 본문은 문장 대신 라벨 줄(페어링 포인트 · 주의 · 맛 프로필, pairing/summary.ts) — 2026-09-14 사용자 요청. 긴 설명(reason)은 "자세히"로 접는다.
 */
import Link from "next/link";
import CardLink from "./CardLink";
import ExtLink from "./ExtLink";
import GradeBadge from "./GradeBadge";
import TriedRating from "./TriedRating";
import MemberPickLine from "./MemberPickLine";
import { D, F, PICK_DETAIL, PICK_LABEL, cardSummary, pickOf, profileLine, toSlug, type Grade, type Pairing, type PickKey } from "@pairinggo/shared";

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
  const c: Record<PickKey, number> = { expert: 0, public: 0, member: 0, profile: 0 };
  for (const it of items) c[pickOf(it.pairing.src)]++;
  return c;
}

export function PairingCards({ items }: { items: CardItem[] }) {
  if (!items.length) return <p className="muted">아직 등록된 페어링이 없습니다.</p>;
  return (
    <ul className="cards">
      {items.map(({ href, name, sub, grade, explain, pairing: p }) => {
        const pick = pickOf(p.src);
        const isDrinkCard = href.startsWith("/drinks");
        const { points, cautions } = cardSummary(p);
        const profile = isDrinkCard ? profileLine("drink", D[p.d]?.profile) : profileLine("food", F[p.f]?.profile);
        return (
          <li key={href} className="card" data-pick={pick}>
            <div className="top">
              <CardLink href={href} d={p.d} f={p.f} from={href.startsWith("/foods") ? "drink" : "food"} className="name">{name}</CardLink>
              <GradeBadge grade={grade} title={explain} />
            </div>
            {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
            {(points.length > 0 || cautions.length > 0 || profile) && (
              <dl className="kv">
                {points.length > 0 ? <div><dt>페어링 포인트</dt><dd>{points.join(" · ")}</dd></div>
                  : p.reason ? <div><dt>페어링 포인트</dt><dd>{p.reason}</dd></div> : null}   {/* 맛 궁합 포인트가 없으면 설명을 그 자리에 */}
                {cautions.length > 0 && <div><dt>주의</dt><dd>{cautions.join(" · ")}</dd></div>}
                {profile && <div><dt>맛 프로필</dt><dd>{profile}</dd></div>}
              </dl>
            )}
            {p.reason && points.length > 0 && <details className="more"><summary>자세히</summary><p className="why">{p.reason}</p></details>}
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
                : pick !== "profile" && pick !== "member" && p.ev?.source ? <span>{p.ev.source}</span> : null}   {/* 회원픽은 아래 "회원 N명 추천" 줄이 출처 */}
            </div>
            <MemberPickLine d={p.d} f={p.f} hideNotes={pick === "member"} />
            <TriedRating d={p.d} f={p.f} />
          </li>
        );
      })}
    </ul>
  );
}

export const drinkHref = (name: string) => `/drinks/${toSlug(name)}`;
export const foodHref = (name: string) => `/foods/${toSlug(name)}`;
