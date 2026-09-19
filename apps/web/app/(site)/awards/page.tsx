/**
 * 전통주 수상작 — 우리술품평회(농식품부·aT) · 대한민국주류대상(조선비즈) 우리술 부문, 대회마다 최근 5개 연도(2026-09-20 사용자 결정).
 * 카탈로그 drinks.awards("2025 우리술품평회 과실주 대상", "2026 대한민국주류대상 탁주 Best of Best")를 대회·연도·등급별로 묶고 양조장·구매 링크를 붙인다.
 * 명단을 카탈로그에 붙이는 것은 `pnpm --filter @pairinggo/db drink-awards`(research/awards/). 수상 사실은 두 대회의 공개 발표.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AWARD_YEARS, DRINK_COMPETITIONS, awardYears, buyLink, onlineSellable, parseDrinkAward, prizeRank, toSlug, type DrinkAward, type Drink } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import ExtLink from "../_components/ExtLink";
import Heart from "../_components/Heart";

export const dynamic = "force-dynamic";   // ?c=&year= 탭
export const metadata: Metadata = {
  title: "전통주 수상작 — 우리술품평회·대한민국주류대상 최근 5년 | 페어링GO",
  description: "우리술품평회(농림축산식품부)와 대한민국주류대상(조선비즈) 우리술 부문에서 상을 받은 전통주를 연도·부문별로 정리하고 양조장과 구매처를 연결합니다.",
  alternates: { canonical: "/awards" },
};

type Row = DrinkAward & { drink: Drink; raw: string };

export default async function AwardsPage({ searchParams }: { searchParams: Promise<{ c?: string; year?: string }> }) {
  const c = await getCatalog();
  const sp = await searchParams;
  const comp = DRINK_COMPETITIONS.find((x) => x.key === sp.c) ?? DRINK_COMPETITIONS[0];
  const all: Row[] = [];
  for (const d of c.dataset.drinks) for (const raw of d.awards || []) { const a = parseDrinkAward(raw); if (a) all.push({ ...a, drink: d, raw }); }
  const rows = all.filter((r) => r.competition === comp.name);
  const years = awardYears(rows.map((r) => r.year), AWARD_YEARS);
  const want = Number(sp.year);
  const selected = years.includes(want) ? want : years[0];
  const list = rows.filter((r) => r.year === selected)
    .sort((a, b) => prizeRank(a.prize) - prizeRank(b.prize) || a.part.localeCompare(b.part, "ko") || a.drink.name.localeCompare(b.drink.name, "ko"));
  const href = (key: string, y?: number) => `/awards?c=${key}${y ? `&year=${y}` : ""}`;

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>{comp.name} 수상 전통주{selected ? <span className="muted"> · {selected}년</span> : null}</h1>
      <ul className="tabs" aria-label="대회">
        {DRINK_COMPETITIONS.map((x) => (
          <li key={x.key}><Link href={href(x.key)} scroll={false} className={x.key === comp.key ? "on" : undefined} aria-current={x.key === comp.key ? "page" : undefined}>{x.name}</Link></li>
        ))}
      </ul>
      <p className="lead">{comp.about} 술을 누르면 어울리는 안주와 근거, 구매처를 볼 수 있습니다.</p>
      {years.length > 0 && (
        <ul className="tabs year-tabs" style={{ marginTop: 14 }} aria-label="연도">
          {years.map((y) => (
            <li key={y}><Link href={href(comp.key, y)} scroll={false} className={y === selected ? "on" : undefined} aria-current={y === selected ? "page" : undefined}>{y}년<span className="cnt">{rows.filter((r) => r.year === y).length}</span></Link></li>
          ))}
        </ul>
      )}

      <section>
        <h2>{selected}년 {comp.name} <span className="muted small">{list.length}종</span></h2>
        {list.length === 0 ? (
          <p className="muted">이 해 수상작 중 페어링GO에 등록된 전통주가 아직 없습니다.</p>
        ) : (
          <ul className="rows">
            {list.map((r) => {
              const d = r.drink, bl = buyLink(d), top = prizeRank(r.prize) === 0;
              return (
                <li key={`${d.id}-${r.raw}`} className="row">
                  <span className={`award prize ${top ? "p0" : r.prize === "대상" ? "p1" : "p2"}`}>{top ? `🏆 ${r.prize}` : [r.part, r.prize].filter(Boolean).join(" ")}</span>
                  <Link href={`/drinks/${toSlug(d.name)}`} className="grow">
                    <b>{d.name}</b>
                    <span className="small muted">{[top && r.part && r.part !== d.category ? r.part : null, d.category, d.abv != null ? `${d.abv}%` : null, d.brewery, d.region].filter(Boolean).join(" · ")}</span>
                  </Link>
                  {onlineSellable(d)
                    ? <ExtLink href={bl.url} event="buy_link_click" props={{ d: d.id, store: bl.store, from: "awards" }} className="small">구매 ↗</ExtLink>
                    : <Link href={`/drinks/${toSlug(d.name)}#places`} className="small">판매점</Link>}
                  <Heart kind="drink" id={d.id} name={d.name} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="small muted" style={{ marginTop: 28 }}>
        수상 정보는 {comp.host} 발표 기준이며, 페어링GO에 등록된 전통주만 보입니다. 빠진 수상주는 목록을 넓혀 가며 채웁니다. 구매는 각 양조장·판매처 페이지에서 이루어지며 만 19세 이상만 가능합니다.
      </p>
    </div>
  );
}
