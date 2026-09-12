/**
 * 요즘 핫한 페어링 조합 — 최근 30일 사용자가 앱에서 눌러 보고, 저장하고, 구매 링크로 넘어간 술+음식 조합 순위.
 * 데이터가 적은 동안은 전문가·블로그 점수 순으로 채우고 그 사실을 적는다(lib/hot.ts).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { SRC_LABEL, buyLink, josa, onlineSellable, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { hotPairs } from "@/lib/hot";
import ExtLink from "../_components/ExtLink";
import Heart from "../_components/Heart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "요즘 핫한 전통주 페어링 조합 — 최근 30일 | 페어링GO",
  description: "최근 한 달 동안 사용자들이 가장 많이 보고 저장하고 구매로 이어진 전통주와 안주 조합입니다.",
  alternates: { canonical: "/hot" },
};

export default async function HotPage() {
  const c = await getCatalog();
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d])), F = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const { list, logged, since } = await hotPairs(c.dataset, 12);
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>요즘 핫한 페어링 조합 <span className="muted">· 최근 30일</span></h1>
      <p className="lead">
        {logged > 0
          ? `${since.slice(0, 10)}부터 지금까지 페어링GO 사용자들이 눌러 보고, 저장하고, 구매 링크로 넘어간 술+안주 조합을 세어 순위를 냈습니다.`
          : "아직 최근 30일 기록이 충분하지 않아 양조장·소믈리에·매체·블로그 근거 점수가 높은 조합을 먼저 보여 드립니다. 사용이 쌓이면 실제 행동 기준으로 바뀝니다."}
        {logged > 0 && logged < list.length && ` 기록이 있는 조합 ${logged}개 뒤로는 근거 점수 순으로 채웠습니다.`}
      </p>
      <ol className="rank">
        {list.map((h, i) => {
          const d = D.get(h.pairing.d), f = F.get(h.pairing.f);
          if (!d || !f) return null;
          const bl = buyLink(d);
          return (
            <li key={`${d.id}|${f.id}`} className="card">
              <div className="top">
                <span className="no">{i + 1}</span>
                <span className="name">
                  <Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link> <span className="muted">×</span> <Link href={`/foods/${toSlug(f.name)}`}>{f.name}</Link>
                </span>
                <span className="score">{h.fromLogs ? `${h.taps + h.saves + h.buys + h.places}회` : `${Math.round(h.pairing.es)}점`}</span>
              </div>
              <div className="small muted">
                {h.fromLogs
                  ? [h.taps ? `조회 ${h.taps}` : null, h.saves ? `저장 ${h.saves}` : null, h.buys ? `구매 클릭 ${h.buys}` : null, h.places ? `식당 찾기 ${h.places}` : null].filter(Boolean).join(" · ")
                  : `${SRC_LABEL[h.pairing.src ?? "profile"]} 근거 · 최근 기록 없음`}
                {" · "}{d.category}{d.abv != null ? ` ${d.abv}%` : ""} · {f.category}
              </div>
              <p className="why">{h.pairing.reason || `${josa(f.name, "과/와")} ${d.name}`}</p>
              <div className="acts">
                <Heart kind="drink" id={d.id} name={d.name} />
                {onlineSellable(d) && <ExtLink href={bl.url} event="buy_link_click" props={{ d: d.id, f: f.id, store: bl.store, from: "hot" }}>구매 ↗</ExtLink>}
                <Link href={`/foods/${toSlug(f.name)}#places`}>{f.name} 맛집</Link>
                <Link href={`/drinks/${toSlug(d.name)}`}>자세히 →</Link>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
