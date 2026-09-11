/**
 * 홈 배너 — 요즘 많이 찾는 전통주가 오른쪽에서 왼쪽으로 흐른다. 서버 렌더 + CSS 애니메이션(자바스크립트 없음).
 * 사진이 있으면 사진, 없으면 카테고리 색 타일(병 실루엣 + 이름). 마우스를 올리면 멈추고, 움직임 줄이기 설정이면 정지.
 */
import Link from "next/link";
import { toSlug, type Drink } from "@pairinggo/shared";

const TONE: Record<string, string> = { 탁주: "tone-tak", 약주: "tone-yak", 청주: "tone-yak", 증류주: "tone-so", 리큐르: "tone-li", 과실주: "tone-fr" };

function Tile({ d, rank }: { d: Drink; rank: number }) {
  return (
    <Link href={`/drinks/${toSlug(d.name)}`} className={`mq-tile ${TONE[d.category] || "tone-etc"}`} aria-label={`${rank}위 ${d.name}`}>
      {d.image?.url ? (
        <img src={d.image.url} alt={d.name} loading="lazy" decoding="async" width={112} height={150} />
      ) : (
        <svg viewBox="0 0 48 100" width="44" height="92" aria-hidden className="bottle">
          <path d="M18 2h12v8l4 4v6l3 4v68a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6V24l3-4v-6l4-4z" />
          <rect x="15" y="44" width="18" height="30" rx="2" className="label" />
        </svg>
      )}
      <span className="rank">{rank}</span>
      <span className="nm">{d.name}</span>
      <span className="ct">{d.category}{d.abv != null ? ` · ${d.abv}%` : ""}</span>
    </Link>
  );
}

export default function HeroMarquee({ drinks, basis }: { drinks: Drink[]; basis: "site" | "trend" | "mixed" }) {
  if (!drinks.length) return null;
  const items = drinks.slice(0, 10);
  const note = basis === "site" ? "이 사이트 검색량 기준" : basis === "mixed" ? "사이트 검색량 + 외부 검색 트렌드" : "최근 한 달 검색 트렌드(네이버·인스타·유튜브) 기준";
  return (
    <section className="marquee" aria-label="요즘 많이 찾는 전통주">
      <div className="mq-head"><b>요즘 많이 찾는 전통주 10</b><span className="muted small">{note}</span></div>
      <div className="mq-viewport">
        {/* 같은 목록을 두 번 이어 붙여 끊김 없이 돈다 — 두 번째는 보조기기에서 숨긴다 */}
        <div className="mq-track">
          {items.map((d, i) => <Tile key={d.id} d={d} rank={i + 1} />)}
          {items.map((d, i) => <span key={"dup" + d.id} aria-hidden><Tile d={d} rank={i + 1} /></span>)}
        </div>
      </div>
    </section>
  );
}
