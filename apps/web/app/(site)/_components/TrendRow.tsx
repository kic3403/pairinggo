/**
 * 이번 주 많이 찾는 전통주 — 큰 사진 카드 가로 스크롤(2026-10-03 UI 리뉴얼, 캐치테이블 "미쉐린 가이드" 카드식).
 * 사진이 있으면 사진, 없으면 종류 색 타일 + 병 그림. 순위 배지(왼쪽 위)·지난주 대비는 글자로("2계단 상승"). 하트는 카드 안 동그라미.
 */
import Link from "next/link";
import { deltaBadge, toSlug, type Drink } from "@pairinggo/shared";
import Heart from "./Heart";

const TONE: Record<string, string> = { 탁주: "linear-gradient(160deg, #FBEAE3, #E8B9A2 60%, #C7471F)", 약주: "linear-gradient(160deg, #F8F1DD, #D8C48F 60%, #8A6D1F)", 청주: "linear-gradient(160deg, #F8F1DD, #D8C48F 60%, #8A6D1F)", 증류주: "linear-gradient(160deg, #EAF0F8, #A9BBD6 60%, #22406B)", 리큐르: "linear-gradient(160deg, #F3E8F5, #C9A6D1 60%, #6B3F7A)", 과실주: "linear-gradient(160deg, #FBE5E5, #E7A0A8 60%, #8E2A32)" };
const DEFAULT = "linear-gradient(160deg, #EDE8DF, #B8AE9A 60%, #5E5345)";
const DELTA_WORD = (k: string, label: string) => (k === "new" ? "새로 진입" : k === "up" ? `${label.replace(/[^0-9]/g, "")}계단 상승` : k === "down" ? `${label.replace(/[^0-9]/g, "")}계단 하락` : "순위 유지");

export default function TrendRow({ drinks, note, compared = false }: { drinks: Drink[]; note: string; compared?: boolean }) {
  if (!drinks.length) return null;
  return (
    <section className="trend trend-v2">
      <div className="section-head"><h2>이번 주 많이 찾는 전통주</h2><Link href="/weekly">전체보기 ›</Link></div>
      <ul className="trend-cards">
        {drinks.slice(0, 8).map((d, i) => {
          const badge = deltaBadge(d.trend, compared);
          return (
            <li key={d.id}>
              <Link href={`/drinks/${toSlug(d.name)}`} className="tc" aria-label={`${i + 1}위 ${d.name}`}>
                <span className="tc-img" style={d.image?.url ? undefined : { background: TONE[d.category] ?? DEFAULT }}>
                  {d.image?.url ? <img src={d.image.url} alt="" loading="lazy" decoding="async" /> : (
                    <svg viewBox="0 0 48 100" width="52" height="108" aria-hidden className="bottle"><path d="M18 2h12v8l4 4v6l3 4v68a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6V24l3-4v-6l4-4z" fill="rgba(255,255,255,.85)" /><rect x="15" y="44" width="18" height="30" rx="2" fill="rgba(0,0,0,.08)" /></svg>
                  )}
                  <span className="tc-rank">{i + 1}위</span>
                </span>
                {badge ? <span className={`tc-delta ${badge.kind}`}>{DELTA_WORD(badge.kind, badge.label)}</span> : <span className="tc-delta" aria-hidden>&nbsp;</span>}
                <b className="tc-name">{d.name}</b>
                <span className="tc-meta">{d.category}{d.abv != null ? ` · ${d.abv}%` : ""}{d.region ? ` · ${d.region.split(" ")[0]}` : ""}</span>
              </Link>
              <Heart kind="drink" id={d.id} name={d.name} />
            </li>
          );
        })}
      </ul>
      <p className="small muted trend-note">{note}</p>
    </section>
  );
}
