/**
 * 검색 — 미니앱과 같은 엔진(packages/shared/search)을 서버에서 돌린다.
 * "매운 안주에 어울리는 술"처럼 상황을 적으면 상황 검색, 이름을 적으면 이름 매칭, 없으면 비슷한 이름 제안.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, POPULAR, POPULAR_FOODS, buyLink, intentSearch, onlineSellable, search, shortAward, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import Heart from "../_components/Heart";
import SearchBox from "../_components/SearchBox";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const q = ((await searchParams).q || "").trim();
  return { title: q ? `‘${q}’ 검색 | 페어링GO` : "검색 | 페어링GO", robots: { index: false } };
}

const drinkHref = (name: string) => `/drinks/${toSlug(name)}`;
const foodHref = (name: string) => `/foods/${toSlug(name)}`;
const browseHref = (kind: string | undefined, key: string | undefined) =>
  kind === "category" ? `/drinks?category=${encodeURIComponent(key || "")}` : kind === "region" ? `/drinks?region=${encodeURIComponent(key || "")}` : `/drinks?brewery=${encodeURIComponent(key || "")}`;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q || "").trim().slice(0, 80);
  await getCatalog();
  const intent = q ? intentSearch(q, 12) : null;
  const res = search(q, { limit: 12 });
  const empty = !!q && !intent && res.hits.length === 0;

  return (
    <div className="wrap">
      <h1>검색</h1>
      <SearchBox initial={q} autoFocus={!q} />

      {!q && (
        <>
          <h2>종류로 찾기</h2>
          <ul className="tabs">{CATEGORIES.map((c) => <li key={c.key}><Link href={`/drinks?category=${encodeURIComponent(c.key)}`}>{c.key}<span className="cnt">{c.count}</span></Link></li>)}</ul>
          <h2>많이 찾는 것</h2>
          <ul className="tabs">
            {POPULAR.slice(0, 6).map((d) => <li key={d.id}><Link href={drinkHref(d.name)}>{d.alias || d.name}</Link></li>)}
            {POPULAR_FOODS.slice(0, 6).map((f) => <li key={f.id}><Link href={foodHref(f.name)}>{f.name}</Link></li>)}
          </ul>
          <p className="small muted" style={{ marginTop: 18 }}>이름뿐 아니라 상황도 됩니다. 예: “매운 안주랑 마실 막걸리”, “회에 어울리는 술”, “도수 낮은 전통주”.</p>
        </>
      )}

      {intent && (
        <section>
          <h2>상황 검색 <span className="muted small">→ 어울리는 {intent.intent.target === "drink" ? "술" : "음식"}</span></h2>
          <ul className="tabs" style={{ marginTop: 0 }}>{intent.intent.explain.map((e) => <li key={e}><span className="tag">{e}</span></li>)}</ul>
          {intent.matchedSubjects > 0 && (
            <p className="small muted">조건에 맞는 {intent.intent.target === "drink" ? "음식" : "술"} {intent.matchedSubjects}종의 페어링을 모아 순위를 냈습니다.</p>
          )}
          <ol className="rank">
            {intent.intent.target === "drink" && intent.drinks.map((r, i) => {
              const bl = buyLink(r.drink);
              return (
                <li key={r.drink.id} className="card">
                  <div className="top">
                    <span className="no">{i + 1}</span>
                    <Link href={drinkHref(r.drink.name)} className="name">{r.drink.name}</Link>
                    <span className="score">{Math.round(r.score)}점</span>
                  </div>
                  <div className="small muted">{[r.drink.category, r.drink.abv != null ? `${r.drink.abv}%` : null, r.drink.region, r.drink.awards?.[0] ? shortAward(r.drink.awards[0]) : null].filter(Boolean).join(" · ")}</div>
                  <p className="why">{r.via ? r.via.reason : r.drink.desc}</p>
                  <div className="acts">
                    <Heart kind="drink" id={r.drink.id} name={r.drink.name} />
                    {onlineSellable(r.drink) && <a href={bl.url} target="_blank" rel="noopener nofollow">구매 ↗</a>}
                    <Link href={drinkHref(r.drink.name)}>자세히 →</Link>
                  </div>
                </li>
              );
            })}
            {intent.intent.target === "food" && intent.foods.map((r, i) => (
              <li key={r.food.id} className="card">
                <div className="top">
                  <span className="no">{i + 1}</span>
                  <Link href={foodHref(r.food.name)} className="name">{r.food.name}</Link>
                  <span className="score">{Math.round(r.score)}점</span>
                </div>
                <div className="small muted">{[r.food.category, ...r.food.tags.slice(0, 3)].join(" · ")}</div>
                <p className="why">{r.via ? r.via.reason : r.food.tags.join(" · ")}</p>
                <div className="acts">
                  <Heart kind="food" id={r.food.id} name={r.food.name} />
                  <Link href={`${foodHref(r.food.name)}#places`}>맛집 찾기</Link>
                  <Link href={foodHref(r.food.name)}>자세히 →</Link>
                </div>
              </li>
            ))}
          </ol>
          {((intent.intent.target === "drink" && !intent.drinks.length) || (intent.intent.target === "food" && !intent.foods.length)) && (
            <p className="muted">조건을 모두 만족하는 {intent.intent.target === "drink" ? "술" : "음식"}이 아직 없습니다. 조건을 하나 줄여 보세요.</p>
          )}
        </section>
      )}

      {q && res.hits.length > 0 && (
        <section>
          <h2>{intent ? "이름으로 찾은 결과" : `‘${q}’ 검색 결과`} <span className="muted small">{res.hits.length}</span></h2>
          <ul className="rows">
            {res.drinks.map((h) => {
              const d = h.doc;
              return (
                <li key={"d" + d.id} className="row">
                  <span className="badge">술</span>
                  <Link href={drinkHref(d.name)} className="grow"><b>{d.name}</b><span className="small muted">{d.meta}</span></Link>
                  {h.kind === "fuzzy" && <span className="small muted">비슷한 이름</span>}
                  <Heart kind="drink" id={d.id} name={d.name} />
                </li>
              );
            })}
            {res.foods.map((h) => {
              const f = h.doc;
              return (
                <li key={"f" + f.id} className="row">
                  <span className="badge f">음식</span>
                  <Link href={foodHref(f.name)} className="grow"><b>{f.name}</b><span className="small muted">{f.meta}</span></Link>
                  {h.kind === "fuzzy" && <span className="small muted">비슷한 이름</span>}
                  <Heart kind="food" id={f.id} name={f.name} />
                </li>
              );
            })}
            {res.browse.map((h) => (
              <li key={"b" + h.doc.id} className="row">
                <span className="badge n">{h.doc.kind === "category" ? "종류" : h.doc.kind === "region" ? "지역" : "양조장"}</span>
                <Link href={browseHref(h.doc.kind, h.doc.key)} className="grow"><b>{h.doc.name}</b><span className="small muted">{h.doc.meta}</span></Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {empty && (
        <section>
          <h2>‘{q}’ — 아직 데이터에 없습니다</h2>
          <p className="muted">비슷한 이름이나 상황으로 다시 찾아보세요.</p>
          {res.suggestions.length > 0 && (
            <>
              <p className="small muted" style={{ marginTop: 16 }}>혹시 이걸 찾으셨나요</p>
              <ul className="tabs">{res.suggestions.map((s) => <li key={s.type + s.id}><Link href={s.type === "drink" ? drinkHref(s.name) : foodHref(s.name)}>{s.name}</Link></li>)}</ul>
            </>
          )}
          <p className="small muted" style={{ marginTop: 16 }}>종류로 찾기</p>
          <ul className="tabs">{CATEGORIES.map((c) => <li key={c.key}><Link href={`/drinks?category=${encodeURIComponent(c.key)}`}>{c.key}</Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}
