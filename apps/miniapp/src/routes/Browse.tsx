import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { browseList, ABV_BANDS, SORT_LABEL, shortAward, type BrowseSort, type AbvBand } from "@pairinggo/shared";
import SaveButton from "@/components/SaveButton";
import { BackHeader } from "@/components/Section";
import { track } from "@/lib/analytics";
import NotFound from "./NotFound";

const KINDS = new Set(["category", "region", "brewery", "food-category"]);
const SORTS: BrowseSort[] = ["popular", "award", "abv-asc", "abv-desc", "name"];

/** 둘러보기 — 종류·지역·양조장·음식 분류 목록 + 정렬·도수·맛 태그 필터 */
export default function Browse() {
  const { kind = "", key = "" } = useParams();
  const [sort, setSort] = useState<BrowseSort>("popular");
  const [abv, setAbv] = useState<AbvBand | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const k = decodeURIComponent(key);
  const ok = KINDS.has(kind);
  const res = useMemo(() => (ok ? browseList({ kind: kind as "category", key: k, sort, abv, tag }) : null), [ok, kind, k, sort, abv, tag]);
  useEffect(() => { if (ok) track("browse", { kind, key: k }); }, [ok, kind, k]);
  if (!ok || !res || !res.total) return <NotFound />;

  return (
    <main className="px-4 pt-4">
      <BackHeader title={res.title} sub={res.sub} />
      {kind !== "food-category" && (
        <>
          <div className="hscroll mt-3 !mx-0 !px-0">
            {SORTS.map((s) => <button key={s} onClick={() => setSort(s)} className={`chip flex-none ${sort === s ? "on" : ""}`}>{SORT_LABEL[s]}</button>)}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ABV_BANDS.map((b) => <button key={b.key} onClick={() => setAbv(abv === b.key ? null : b.key)} className={`chip ${abv === b.key ? "on" : ""}`}>{b.label}</button>)}
            {res.tags.map((t) => <button key={t.tag} onClick={() => setTag(tag === t.tag ? null : t.tag)} className={`chip ${tag === t.tag ? "on" : ""}`}>{t.tag} <span className="text-muted">{t.count}</span></button>)}
          </div>
          <p className="text-[11.5px] text-muted mt-2">{res.drinks.length}종{abv || tag ? ` · 필터 적용` : ""}</p>
          <div className="flex flex-col mt-1">
            {res.drinks.map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 py-3 border-b border-line">
                <span className="w-5 text-[12px] text-muted num">{i + 1}</span>
                <Link to={`/drink/${d.id}`} className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px]">{d.name}{d.awards?.[0] && <span className="award ml-1.5 align-middle">{shortAward(d.awards[0])}</span>}</div>
                  <div className="text-[11.5px] text-muted mt-0.5">{d.category}{d.abv != null ? ` · ${d.abv}%` : ""} · {d.region || d.brewery} · {d.flavor.slice(0, 3).join(" · ")}</div>
                </Link>
                <SaveButton item={{ k: "drink", id: d.id }} />
              </div>
            ))}
            {!res.drinks.length && <p className="text-[13px] text-muted py-6 text-center">조건에 맞는 술이 없어요. 필터를 풀어 보세요.</p>}
          </div>
        </>
      )}
      {kind === "food-category" && (
        <div className="flex flex-col mt-3">
          {res.foods.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 py-3 border-b border-line">
              <span className="w-5 text-[12px] text-muted num">{i + 1}</span>
              <Link to={`/food/${f.id}`} className="flex-1 min-w-0"><div className="font-semibold text-[15px]">{f.name}</div><div className="text-[11.5px] text-muted mt-0.5">{f.tags.join(" · ")}</div></Link>
              <SaveButton item={{ k: "food", id: f.id }} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
