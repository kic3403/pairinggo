/**
 * 오늘의 페어링(2026-09-27 사용자 결정 — '핫한 페어링'과 따로). 근거가 확인된 조합 가운데 날마다 하나, 계절 제철 음식 조합을 먼저.
 * 고르는 규칙은 shared pairing/today.ts(같은 날짜면 누구에게나 같은 조합). 핫한 페어링(/hot)은 사람들이 많이 본 순위.
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  SRC_LABEL, buyLink, cardSummary, confidenceOf, confidenceText, gradeOf, josa, kindOf, kstParts, onlineSellable, pairingScore,
  recentTodayPicks, subtypeLabel, toSlug, todayPick, type Pairing,
} from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import DetailMedia, { KIND_TONE } from "../_components/DetailMedia";
import ExtLink from "../_components/ExtLink";
import GradeBadge from "../_components/GradeBadge";
import Heart from "../_components/Heart";
import ShareButton from "../_components/ShareButton";

// 날짜가 바뀌면 조합이 바뀐다 — 10분마다 다시 그린다(자정 직후 최대 10분은 어제 조합)
export const revalidate = 600;
export const metadata: Metadata = {
  title: "오늘의 페어링 — 날마다 하나, 근거가 확인된 술과 안주 | 페어링GO",
  description: "양조장·소믈리에·매체가 확인한 전통주와 안주 조합 가운데 오늘의 한 조합을 골라 드립니다. 계절 제철 음식이 들어간 조합을 먼저.",
  alternates: { canonical: "/today", types: { "application/rss+xml": [{ url: "/rss.xml", title: "페어링GO 오늘의 페어링" }] } },
};

const md = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export default async function TodayPage() {
  const c = await getCatalog();
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d])), F = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const date = kstParts(new Date()).date;
  const t = todayPick(c.dataset, date);
  if (!t) return <div className="wrap"><h1>오늘의 페어링</h1><p className="muted">근거가 확인된 조합이 아직 없어요.</p></div>;
  const d = D.get(t.main.d)!, f = F.get(t.main.f)!;
  const kind = kindOf(d);
  const p = t.main;
  const { points, cautions } = cardSummary(p);
  const bl = buyLink(d);
  const recent = recentTodayPicks(c.dataset, date, 6);
  const row = (x: Pairing, show: "food" | "drink") => {
    const other = show === "food" ? F.get(x.f) : D.get(x.d);
    if (!other) return null;
    const href = show === "food" ? `/foods/${toSlug(other.name)}?d=${x.d}` : `/drinks/${toSlug(other.name)}`;
    return (
      <li key={`${x.d}|${x.f}`} className="row">
        <Link href={href} className="grow"><b>{other.name}</b><span className="small muted">{confidenceText(x)}</span></Link>
        <GradeBadge grade={gradeOf(x)} title={`어울림 ${pairingScore(x)} · ${confidenceText(x)}`} />
      </li>
    );
  };

  return (
    <div className="wrap today">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>오늘의 페어링 <span className="muted small">{md(date)} ({t.weekday})</span></h1>

      <article className="today-hero">
        <p className="today-head">{t.headline}</p>
        <div className="today-pair">
          <Link href={`/drinks/${toSlug(d.name)}`} className="tp-side">
            <DetailMedia kind="drink" image={d.image} name={d.name} label={kind === "trad" ? d.category : subtypeLabel(d)} tone={KIND_TONE[kind]} />
            <b>{d.name}</b>
            <span className="small muted">{[kind === "trad" ? d.category : subtypeLabel(d), d.abv != null ? `${d.abv}%` : null, d.brewery].filter(Boolean).join(" · ")}</span>
          </Link>
          <span className="tp-x" aria-hidden>×</span>
          <Link href={`/foods/${toSlug(f.name)}?d=${d.id}`} className="tp-side">
            <DetailMedia kind="food" image={f.image} name={f.name} label={f.category} />
            <b>{f.name}</b>
            <span className="small muted">{[f.category, ...(f.tags ?? []).slice(0, 2)].join(" · ")}</span>
          </Link>
        </div>
        <div className="today-grade">
          <GradeBadge grade={gradeOf(p)} title={`어울림 ${pairingScore(p)}`} />
          {confidenceOf(p) !== "estimate" && <span className={`conf ${confidenceOf(p)}`}>{confidenceText(p)}{p.checked ? ` · ${p.checked.slice(0, 7).replace("-", ".")} 확인` : ""}</span>}
          <span className="small muted">{SRC_LABEL[p.src ?? "profile"]}</span>
        </div>
        {(points.length > 0 || cautions.length > 0) && (
          <ul className="pts" aria-label="페어링 포인트">
            {points.map((x) => <li key={"p" + x.label} className="pt" title={x.full}>{x.label}</li>)}
            {cautions.map((x) => <li key={"c" + x.label} className="pt warn" title={x.full}>{x.label}</li>)}
          </ul>
        )}
        {p.ev?.quote ? (
          <blockquote className="quote">“{p.ev.quote}”{p.ev.who && <span className="muted"> — {p.ev.who}</span>}</blockquote>
        ) : p.reason ? <p className="why">{p.reason}</p> : null}
        {p.ev?.url && <p className="small"><ExtLink href={p.ev.url} event="external_link" props={{ d: p.d, f: p.f, kind: "evidence", from: "today" }}>{p.ev.source || "출처 보기"} ↗</ExtLink></p>}
        <div className="btns">
          <Link className="btn p" href={`/foods/${toSlug(f.name)}?d=${d.id}#places`}>{f.name} 맛집 찾기</Link>
          {onlineSellable(d) && <ExtLink className="btn" href={bl.url} event="buy_link_click" props={{ d: d.id, f: f.id, store: bl.store, from: "today" }}>{d.name} 구매 ↗</ExtLink>}
          <Heart kind="drink" id={d.id} name={d.name} variant="button" />
          <ShareButton className="btn" title={`오늘의 페어링 — ${josa(d.name, "과/와")} ${f.name}`} text={`${t.headline}: ${d.name} × ${f.name} — 페어링GO`} path="/today" d={d.id} f={f.id} />
        </div>
      </article>

      <div className="today-more">
        {t.alsoFoods.length > 0 && <section className="box"><h3>{josa(d.name, "은/는")} 이것과도</h3><ul className="rows">{t.alsoFoods.map((x) => row(x, "food"))}</ul></section>}
        {t.alsoDrinks.length > 0 && <section className="box"><h3>{f.name}에는 이 술도</h3><ul className="rows">{t.alsoDrinks.map((x) => row(x, "drink"))}</ul></section>}
      </div>

      {recent.length > 0 && (
        <section>
          <h2>지난 오늘의 페어링</h2>
          <ul className="rows today-past">
            {recent.map((r) => {
              const rd = D.get(r.main.d), rf = F.get(r.main.f);
              if (!rd || !rf) return null;
              return (
                <li key={r.date} className="row">
                  <span className="small muted tp-date">{md(r.date)}</span>
                  <Link href={`/drinks/${toSlug(rd.name)}`} className="grow"><b>{rd.name} <span className="muted">×</span> {rf.name}</b><span className="small muted">{confidenceText(r.main)}</span></Link>
                  <GradeBadge grade={gradeOf(r.main)} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="small muted" style={{ marginTop: 18 }}>
        양조장·소믈리에·매체가 확인한 조합 {t.pool.toLocaleString("ko-KR")}개 가운데 날마다 하나를 골라요. {t.seasonalPool > 0 ? `${josa(`${t.season === "spring" ? "봄" : t.season === "summer" ? "여름" : t.season === "autumn" ? "가을" : "겨울"} 제철 음식이 들어간 조합 ${t.seasonalPool}개`, "을/를")} 계절 앞쪽에 먼저 보여 드려요. ` : ""}
        사람들이 많이 본 조합은 <Link href="/hot">핫한 페어링</Link>에서 볼 수 있어요.
      </p>
    </div>
  );
}
