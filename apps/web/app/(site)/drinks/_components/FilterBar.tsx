"use client";
/**
 * 필터 바로가기 줄(2026-09-24, 요구사항 §2·§11) — [가격] [용량] [음식] [전체 필터] + 적용한 조건 칩(개별 제거) + 결과 수 + 정렬.
 * 가격·용량은 어느 주종·'전체' 탭에서나 같은 자리. 버튼은 선택 조건을 요약해 보여 준다("3만~7만원"·"500~750mL").
 * 누르면 같은 필터 패널(FilterSheet)의 그 그룹이 열린다. 닫히면 연 버튼으로 초점을 돌려준다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FOOD_FILTERS } from "@pairinggo/shared/kinds";
import { SORT_LABELS, filterChips, filterHref, mlSummary, priceSummary, rangeActive, type DrinkFilter, type DrinkSort } from "@pairinggo/shared/filter-url";
import FilterSheet, { type FilterGroup } from "./FilterSheet";

export default function FilterBar({ applied, total, flavors, volumes }: { applied: DrinkFilter; total: number; flavors: string[]; volumes: number[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<FilterGroup | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const chips = filterChips(applied);
  const show = (g: FilterGroup) => (e: React.MouseEvent<HTMLButtonElement>) => { opener.current = e.currentTarget; setOpen(g); };
  const close = () => { setOpen(null); setTimeout(() => opener.current?.focus(), 0); };
  const foodLabel = applied.food.length ? applied.food.map((id) => FOOD_FILTERS.find((x) => x.id === id)?.label ?? id).slice(0, 2).join("·") + (applied.food.length > 2 ? ` 외 ${applied.food.length - 2}` : "") : "음식";
  const detailN = chips.length;

  return (
    <div className="fbar">
      <div className="fbar-btns" role="group" aria-label="필터 바로가기">
        <button type="button" className={`fbtn${rangeActive(applied.price) ? " on" : ""}`} onClick={show("price")}>{priceSummary(applied.price)}</button>
        <button type="button" className={`fbtn${rangeActive(applied.ml) ? " on" : ""}`} onClick={show("ml")}>{mlSummary(applied.ml)}</button>
        <button type="button" className={`fbtn${applied.food.length ? " on" : ""}`} onClick={show("food")}>{foodLabel}</button>
        <button type="button" className={`fbtn all${detailN ? " on" : ""}`} onClick={show("cat")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          전체 필터{detailN ? ` ${detailN}` : ""}
        </button>
      </div>
      <div className="fbar-row">
        <p className="fbar-total" aria-live="polite"><b>{total.toLocaleString("ko-KR")}</b>종</p>
        {chips.length > 0 && (
          <ul className="fchips applied" aria-label="적용한 조건">
            {chips.map((c) => <li key={c.key}><Link href={filterHref(c.remove)} className="fchip on" aria-label={`${c.label} 조건 제거`} scroll={false}>{c.label} <span aria-hidden>✕</span></Link></li>)}
            <li><Link href={filterHref({ ...applied, ...chips[chips.length - 1].remove, price: { min: null, max: null }, ml: { min: null, max: null }, abv: { min: null, max: null }, food: [], country: [], flavor: [], attrs: {}, cat: null, brewery: null })} className="fchip clear" scroll={false}>모두 지우기</Link></li>
          </ul>
        )}
        <label className="fbar-sort">
          <span className="sr-only">정렬</span>
          <select value={applied.sort} onChange={(e) => router.push(filterHref({ ...applied, sort: e.target.value as DrinkSort }))}>
            {(Object.keys(SORT_LABELS) as DrinkSort[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
          </select>
        </label>
      </div>
      <FilterSheet open={open != null} group={open ?? "cat"} applied={applied} flavors={flavors} volumes={volumes} onClose={close} />
    </div>
  );
}
