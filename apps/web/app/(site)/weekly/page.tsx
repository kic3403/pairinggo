/**
 * 이번 주 많이 찾는 술(2026-10-02 사용자 요청) — 술 종류별 TOP 5. 전통주·위스키·사케·와인을 따로 보여 주고, 종류마다 SNS용 그림 카드와 글을 준다.
 * 순위가 매겨진 술이 3개 이상인 종류만 나온다(shared seo/weekly.ts) — 지금은 전통주뿐이고 다른 종류는 카탈로그에 들어오면 저절로 나타난다.
 * 월간 리포트(/report)는 한 달치 한 장, 여기는 종류별 주간 순위.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumb, itemList, kstToday, toSlug, weekLabel, weeklyCaption, weeklyTopByKind } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import CardDownload from "../_components/CardDownload";
import CopyButton from "../_components/CopyButton";
import JsonLd from "../_components/JsonLd";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "이번 주 많이 찾는 술 TOP 5 — 전통주 인기 순위 | 페어링GO",
  description: "인스타·유튜브·블로그 최근 30일 언급량으로 매긴 술 종류별 인기 순위입니다. 순위에 오른 술마다 어울리는 음식을 근거와 함께 봅니다.",
  alternates: { canonical: "/weekly" },
};

export default async function WeeklyPage() {
  const c = await getCatalog();
  const today = kstToday();
  const tops = weeklyTopByKind(c.dataset.drinks, !!c.dataset.trend_meta?.compared_to);
  const base = siteUrl();
  const ld = [
    breadcrumb([{ name: "홈", path: "/" }, { name: "이번 주 많이 찾는 술", path: "/weekly" }], base),
    ...tops.map((t) => itemList(t.rows.map((r) => ({ name: r.drink.name, path: `/drinks/${toSlug(r.drink.name)}` })), { base, name: `많이 찾는 ${t.label} TOP ${t.rows.length}` })),
  ];
  return (
    <div className="wrap weekly">
      <JsonLd data={ld} />
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>이번 주 많이 찾는 술 <span className="muted small">{weekLabel(today)}</span></h1>
      <p className="lead">인스타·유튜브·블로그에서 최근 30일 동안 많이 이야기된 순서예요. 술 종류별로 다섯 가지씩, 날마다 새로 매깁니다.</p>
      {!tops.length && <p className="muted">아직 순위가 없어요.</p>}
      {tops.map((t) => (
        <section key={t.kind} className="box weekly-kind" aria-labelledby={`wk-${t.kind}`}>
          <h2 id={`wk-${t.kind}`}>많이 찾는 {t.label} TOP {t.rows.length}</h2>
          <ol className="weekly-list">
            {t.rows.map((r) => (
              <li key={r.drink.id}>
                <span className="rank" aria-hidden>{r.rank}</span>
                <Link className="grow" href={`/drinks/${toSlug(r.drink.name)}`}>
                  <b>{r.drink.name}</b>
                  <span className="small muted">{[r.drink.category, r.drink.abv != null ? `${r.drink.abv}%` : null, r.drink.brewery].filter(Boolean).join(" · ")}</span>
                </Link>
                {r.badge && <span className={`dl ${r.badge.startsWith("▲") ? "up" : r.badge.startsWith("▼") ? "down" : "new"}`}>{r.badge}</span>}
              </li>
            ))}
          </ol>
          <div className="btns">
            <CardDownload href={`/weekly/${t.kind}/card.png`} filename={`pairinggo-weekly-${t.kind}-${today}.png`} from={`weekly_${t.kind}`} className="btn p" />
            <CopyButton text={weeklyCaption(t, today, base)} label="글 복사" />
            <Link className="btn" href={`/drinks?kind=${t.kind}`}>{t.label} 전체 보기</Link>
          </div>
        </section>
      ))}
      <p className="small muted" style={{ marginTop: 16 }}>
        그림 카드(1080×1350)와 글을 받아 인스타·블로그에 바로 올릴 수 있어요. 한 달치 흐름은 <Link href="/report">월간 트렌드 리포트</Link>, 날마다 한 조합은 <Link href="/today">오늘의 페어링</Link>에서 볼 수 있습니다.
      </p>
    </div>
  );
}
