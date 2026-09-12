/**
 * 우리술품평회 수상 전통주 — 최근 3개 연도. 카탈로그 drinks.awards("2025 우리술품평회 과실주 대상")를 연도·등급별로 묶고 양조장·구매 링크를 붙인다.
 * 우리술품평회는 농림축산식품부·한국농수산식품유통공사(aT) 주최 — 수상 사실은 공개 정보.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { buyLink, onlineSellable, toSlug, type Drink } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import ExtLink from "../_components/ExtLink";
import Heart from "../_components/Heart";

export const dynamic = "force-dynamic";   // ?year= 탭
export const metadata: Metadata = {
  title: "우리술품평회 수상 전통주 — 최근 3년 대통령상·대상·최우수상 | 페어링GO",
  description: "농림축산식품부 우리술품평회에서 상을 받은 전통주를 연도·부문별로 정리하고 양조장과 구매처를 연결합니다.",
  alternates: { canonical: "/awards" },
};

type Row = { drink: Drink; year: number; category: string; prize: string; raw: string };
const PRIZE_RANK: Record<string, number> = { 대통령상: 0, 대상: 1, 최우수상: 2, 우수상: 3 };
const parse = (d: Drink, a: string): Row | null => {
  const m = a.match(/(20\d\d)\s*우리술품평회\s*(.*)$/);
  if (!m) return null;
  const rest = m[2].trim();
  const prize = Object.keys(PRIZE_RANK).find((p) => rest.endsWith(p)) ?? rest;
  const category = rest.replace(prize, "").trim() || "종합";
  return { drink: d, year: Number(m[1]), category, prize, raw: a };
};

export default async function AwardsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const c = await getCatalog();
  const rows: Row[] = [];
  for (const d of c.dataset.drinks) for (const a of d.awards || []) { const r = parse(d, a); if (r) rows.push(r); }
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a).slice(0, 3);
  const inYears = rows.filter((r) => years.includes(r.year));
  // 연도 탭 — 고른 연도만 보여 준다. 없거나 범위 밖이면 최신 연도
  const want = Number((await searchParams).year);
  const selected = years.includes(want) ? want : years[0];

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>우리술품평회 수상 전통주 <span className="muted">· {selected}년</span></h1>
      <p className="lead">농림축산식품부가 해마다 여는 우리술품평회에서 상을 받은 술입니다. 대통령상은 그해 최고의 술 한 병에만 주어집니다. 술을 누르면 어울리는 안주와 근거, 구매처를 볼 수 있습니다.</p>
      <ul className="tabs year-tabs" style={{ marginTop: 14 }} aria-label="연도">
        {years.map((y) => (
          <li key={y}><Link href={`/awards?year=${y}`} scroll={false} className={y === selected ? "on" : undefined} aria-current={y === selected ? "page" : undefined}>{y}년<span className="cnt">{inYears.filter((r) => r.year === y).length}</span></Link></li>
        ))}
      </ul>

      {years.filter((y) => y === selected).map((y) => {
        const list = inYears.filter((r) => r.year === y).sort((a, b) => (PRIZE_RANK[a.prize] ?? 9) - (PRIZE_RANK[b.prize] ?? 9) || a.category.localeCompare(b.category, "ko"));
        return (
          <section key={y} id={`y${y}`}>
            <h2>{y}년 우리술품평회 <span className="muted small">{list.length}종</span></h2>
            <ul className="rows">
              {list.map((r) => {
                const d = r.drink, bl = buyLink(d);
                return (
                  <li key={`${y}-${d.id}-${r.raw}`} className="row">
                    <span className={`award prize ${r.prize === "대통령상" ? "p0" : r.prize === "대상" ? "p1" : "p2"}`}>{r.prize === "대통령상" ? "🏆 대통령상" : `${r.category} ${r.prize}`}</span>
                    <Link href={`/drinks/${toSlug(d.name)}`} className="grow">
                      <b>{d.name}</b>
                      <span className="small muted">{[d.category, d.abv != null ? `${d.abv}%` : null, d.brewery, d.region].filter(Boolean).join(" · ")}</span>
                    </Link>
                    {onlineSellable(d)
                      ? <ExtLink href={bl.url} event="buy_link_click" props={{ d: d.id, store: bl.store, from: "awards" }} className="small">구매 ↗</ExtLink>
                      : <Link href={`/drinks/${toSlug(d.name)}#places`} className="small">판매점</Link>}
                    <Heart kind="drink" id={d.id} name={d.name} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="small muted" style={{ marginTop: 28 }}>수상 정보는 농림축산식품부·aT 발표 기준이며, 카탈로그에 등록된 전통주만 보입니다. 빠진 수상주가 있으면 어드민에서 술을 추가하면 자동으로 나타납니다. 구매는 각 양조장·판매처 페이지에서 이루어지며 만 19세 이상만 가능합니다.</p>
    </div>
  );
}
