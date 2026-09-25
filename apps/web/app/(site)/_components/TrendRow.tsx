/**
 * 많이 찾는 전통주 — 정지한 가로 스크롤 카드(2026-09-25, 흘러가는 마키 HeroMarquee 대신 — 사용자 결정). 사진이 있으면 사진, 없으면 종류 색 타일.
 */
import Link from "next/link";
import { deltaBadge, toSlug, type Drink } from "@pairinggo/shared";

const TONE: Record<string, string> = { 탁주: "tone-tak", 약주: "tone-yak", 청주: "tone-yak", 증류주: "tone-so", 리큐르: "tone-li", 과실주: "tone-fr" };

export default function TrendRow({ drinks, note, compared = false }: { drinks: Drink[]; note: string; compared?: boolean }) {
  if (!drinks.length) return null;
  return (
    <section className="trend">
      <div className="section-head"><h2>요즘 많이 찾는 전통주</h2><Link href="/report">순위 전체</Link></div>
      <p className="small muted trend-note">{note}{compared ? " ▲▼는 지난주 순위 대비." : ""}</p>
      <ul className="trend-row">
        {drinks.slice(0, 10).map((d, i) => {
          const badge = deltaBadge(d.trend, compared);
          return (
            <li key={d.id}>
              <Link href={`/drinks/${toSlug(d.name)}`} className={`mq-tile ${TONE[d.category] || "tone-etc"}`} aria-label={`${i + 1}위 ${d.name}`}>
                {d.image?.url ? <img src={d.image.url} alt="" loading="lazy" decoding="async" width={112} height={150} /> : (
                  <svg viewBox="0 0 48 100" width="44" height="92" aria-hidden className="bottle"><path d="M18 2h12v8l4 4v6l3 4v68a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6V24l3-4v-6l4-4z" /><rect x="15" y="44" width="18" height="30" rx="2" className="label" /></svg>
                )}
                <span className="rank">{i + 1}</span>
                {badge && <span className={`dl ${badge.kind}`}>{badge.label}</span>}
                <span className="nm">{d.name}</span>
                <span className="ct">{d.category}{d.abv != null ? ` · ${d.abv}%` : ""}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
