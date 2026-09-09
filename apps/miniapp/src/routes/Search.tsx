import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { search, intentSearch, buyLink, onlineSellable, POPULAR, POPULAR_FOODS, CATEGORIES, shortAward } from "@pairinggo/shared";
import SearchBox from "@/components/SearchBox";
import SaveButton from "@/components/SaveButton";
import ExtLink from "@/components/ExtLink";
import { track } from "@/lib/analytics";

/** 검색 결과 — 상황 검색이 해석되면 조건 칩 + 근거 있는 순위, 아니면 이름 매칭 결과(술/음식/둘러보기), 둘 다 없으면 제안 */
export default function Search() {
  const [sp] = useSearchParams();
  const q = (sp.get("q") || "").trim();
  const intent = useMemo(() => (q ? intentSearch(q, 12) : null), [q]);
  const res = useMemo(() => search(q, { limit: 12 }), [q]);
  const empty = !intent && res.hits.length === 0;

  useEffect(() => {
    if (!q) return;
    if (intent) track("search_intent", { q, target: intent.intent.target, n: intent.intent.target === "drink" ? intent.drinks.length : intent.foods.length });
    else if (empty) track("search_empty", { q });
    else track("search", { q, n: res.hits.length, kind: "page" });
  }, [q, intent, empty, res.hits.length]);

  return (
    <main className="px-5 pt-6">
      <h1 className="font-bold text-[22px] tracking-tight">검색</h1>
      <div className="mt-3"><SearchBox autoFocus={!q} initial={q} /></div>

      {!q && (
        <>
          <div className="sec-label mt-7">종류별로 찾기</div>
          <div className="flex flex-wrap gap-2 mt-3">{CATEGORIES.map((c) => <Link key={c.key} to={`/browse/category/${encodeURIComponent(c.key)}`} className="chip">{c.key} <span className="text-muted">{c.count}</span></Link>)}</div>
          <div className="sec-label mt-7">인기 검색어</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {POPULAR.slice(0, 6).map((d) => <Link key={d.id} to={`/drink/${d.id}`} className="chip"><b className="text-drink">술</b>{d.alias}</Link>)}
            {POPULAR_FOODS.slice(0, 6).map((f) => <Link key={f.id} to={`/food/${f.id}`} className="chip"><b className="text-food">음식</b>{f.name}</Link>)}
          </div>
        </>
      )}

      {intent && (
        <section className="mt-5">
          <div className="text-[10.5px] font-bold tracking-widest text-accent-ink">상황 검색</div>
          <div className="flex flex-wrap gap-1.5 mt-2">{intent.intent.explain.map((e) => <span key={e} className="chip on">{e}</span>)}<span className="chip">{intent.intent.target === "drink" ? "→ 어울리는 술" : "→ 어울리는 음식"}</span></div>
          {intent.matchedSubjects > 0 && <p className="text-[12px] text-muted mt-2">조건에 맞는 {intent.intent.target === "drink" ? "음식" : "술"} {intent.matchedSubjects}종의 페어링 {intent.intent.target === "drink" ? intent.drinks.reduce((a, r) => a + r.count, 0) : intent.foods.reduce((a, r) => a + r.count, 0)}건을 모아 순위를 냈어요.</p>}
          <div className="flex flex-col gap-3 mt-3">
            {intent.intent.target === "drink" && intent.drinks.map((r, i) => {
              const bl = buyLink(r.drink);
              return (
                <div key={r.drink.id} className="card p-4">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center font-black text-sm ${i === 0 ? "text-drink" : "text-muted"}`}>{i + 1}</span>
                    <Link to={`/drink/${r.drink.id}`} className="flex-1 min-w-0 font-serif font-bold text-[17px]">
                      {r.drink.name} <small className="font-sans font-medium text-[11.5px] text-muted">{r.drink.category}{r.drink.abv != null ? ` · ${r.drink.abv}%` : ""}</small>
                      {r.drink.awards?.[0] && <span className="award ml-1.5 align-middle">{shortAward(r.drink.awards[0])}</span>}
                    </Link>
                    <span className="text-right"><span className="block font-black text-[17px] num text-drink">{Math.round(r.score)}</span><span className="block text-[10.5px] font-bold text-muted -mt-0.5">{r.count ? `페어링 ${r.count}건` : "인기"}</span></span>
                  </div>
                  <p className="text-[13.5px] text-ink2 mt-2.5">{r.via ? `${r.via.reason}` : r.drink.desc}</p>
                  <div className="flex items-center justify-between mt-2.5 text-[11.5px]">
                    <span className="text-muted">{r.drink.region || r.drink.brewery}</span>
                    <span className="flex items-center gap-3 font-bold">
                      <SaveButton item={{ k: "drink", id: r.drink.id }} />
                      {onlineSellable(r.drink) && <ExtLink href={bl.url} kind="buy" meta={{ drink: r.drink.id }} className="text-drink-ink">구매</ExtLink>}
                      <Link to={`/drink/${r.drink.id}`} className="text-drink-ink">자세히 →</Link>
                    </span>
                  </div>
                </div>
              );
            })}
            {intent.intent.target === "food" && intent.foods.map((r, i) => (
              <div key={r.food.id} className="card p-4">
                <div className="flex items-center gap-2.5">
                  <span className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center font-black text-sm ${i === 0 ? "text-food" : "text-muted"}`}>{i + 1}</span>
                  <Link to={`/food/${r.food.id}`} className="flex-1 min-w-0 font-serif font-bold text-[17px]">{r.food.name} <small className="font-sans font-medium text-[11.5px] text-muted">{r.food.category}</small></Link>
                  <span className="text-right"><span className="block font-black text-[17px] num text-food">{Math.round(r.score)}</span><span className="block text-[10.5px] font-bold text-muted -mt-0.5">{r.count ? `페어링 ${r.count}건` : "인기"}</span></span>
                </div>
                <p className="text-[13.5px] text-ink2 mt-2.5">{r.via ? r.via.reason : r.food.tags.join(" · ")}</p>
                <div className="flex items-center justify-between mt-2.5 text-[11.5px]">
                  <span className="text-muted">{r.food.tags.slice(0, 3).join(" · ")}</span>
                  <span className="flex items-center gap-3 font-bold">
                    <SaveButton item={{ k: "food", id: r.food.id }} />
                    <Link to={`/restaurants?food=${encodeURIComponent(r.food.name)}`} className="text-food-ink">내 주변 식당</Link>
                    <Link to={`/food/${r.food.id}`} className="text-food-ink">자세히 →</Link>
                  </span>
                </div>
              </div>
            ))}
            {((intent.intent.target === "drink" && !intent.drinks.length) || (intent.intent.target === "food" && !intent.foods.length)) && (
              <p className="text-[13px] text-muted py-6 text-center">조건을 모두 만족하는 {intent.intent.target === "drink" ? "술" : "음식"}이 아직 없어요. 조건을 하나 줄여 보세요.</p>
            )}
          </div>
          {res.hits.length > 0 && <p className="sec-label mt-7">이름으로 찾은 결과</p>}
        </section>
      )}

      {q && res.hits.length > 0 && (
        <section className={intent ? "mt-3" : "mt-5"}>
          {res.drinks.length > 0 && <Group title="술" items={res.drinks.map((h) => ({ to: `/drink/${h.doc.id}`, name: h.doc.name, meta: h.doc.meta, badge: "술", fuzzy: h.kind === "fuzzy" }))} />}
          {res.foods.length > 0 && <Group title="음식" items={res.foods.map((h) => ({ to: `/food/${h.doc.id}`, name: h.doc.name, meta: h.doc.meta, badge: "음식", fuzzy: h.kind === "fuzzy" }))} />}
          {res.browse.length > 0 && <Group title="둘러보기" items={res.browse.map((h) => ({ to: `/browse/${h.doc.kind}/${encodeURIComponent(h.doc.key!)}`, name: h.doc.name, meta: h.doc.meta, badge: h.doc.kind === "category" ? "종류" : h.doc.kind === "region" ? "지역" : "양조장", fuzzy: false }))} />}
        </section>
      )}

      {q && empty && (
        <section className="mt-6 text-center">
          <div className="text-[17px] font-bold">‘{q}’ — 아직 데이터에 없어요</div>
          <p className="text-[13px] text-muted mt-2">전통주 108종·음식 110종 안에서 찾습니다. 비슷한 이름이나 상황으로 다시 물어보세요.</p>
          {res.suggestions.length > 0 && <>
            <div className="text-[11.5px] font-bold tracking-widest text-muted mt-5">혹시 이걸 찾으셨나요</div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">{res.suggestions.map((s) => <Link key={s.id} to={`/${s.type}/${s.id}`} className="chip">{s.name}</Link>)}</div>
          </>}
          <div className="text-[11.5px] font-bold tracking-widest text-muted mt-5">종류로 찾기</div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">{CATEGORIES.map((c) => <Link key={c.key} to={`/browse/category/${encodeURIComponent(c.key)}`} className="chip">{c.key}</Link>)}</div>
          <div className="text-[11.5px] font-bold tracking-widest text-muted mt-5">인기 검색어</div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">{POPULAR.slice(0, 5).map((d) => <Link key={d.id} to={`/drink/${d.id}`} className="chip">{d.alias}</Link>)}{POPULAR_FOODS.slice(0, 5).map((f) => <Link key={f.id} to={`/food/${f.id}`} className="chip">{f.name}</Link>)}</div>
        </section>
      )}
    </main>
  );
}

function Group({ title, items }: { title: string; items: { to: string; name: string; meta: string; badge: string; fuzzy: boolean }[] }) {
  return (
    <div className="mt-4">
      <div className="text-[11.5px] font-bold text-ink2">{title} <span className="text-muted font-medium">{items.length}</span></div>
      <div className="flex flex-col mt-1">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="flex items-center gap-3 py-3 border-b border-line">
            <span className={`text-[10.5px] font-bold rounded-md px-1.5 py-0.5 shrink-0 ${it.badge === "술" ? "badge-drink" : it.badge === "음식" ? "badge-food" : "border border-line text-muted"}`}>{it.badge}</span>
            <span className="flex-1 min-w-0"><span className="font-medium">{it.name}</span><div className="text-xs text-muted truncate">{it.meta}</div></span>
            {it.fuzzy && <span className="text-[10px] text-muted">비슷한 이름</span>}
            <span className="text-muted">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
