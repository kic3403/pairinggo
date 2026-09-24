"use client";
/**
 * 주종의 세부 종류 칩(단일 선택) — 사케처럼 많으면 첫 줄만 보이고 [더보기]로 편다(KindDef.firstRow). 선택한 세부에 자식(그레인 → 싱글그레인…)이 있으면 아래 줄에 보인다.
 * 링크는 지금 적용된 공통 조건(가격·용량·음식…)을 그대로 들고 간다.
 */
import Link from "next/link";
import { useState } from "react";
import { KIND_BY_ID } from "@pairinggo/shared/kinds";
import type { DrinkKind } from "@pairinggo/shared/filter-url";
import { filterHref, type DrinkFilter } from "@pairinggo/shared/filter-url";

export default function SubtypeChips({ kind, applied, counts }: { kind: DrinkKind; applied: DrinkFilter; counts: Record<string, number> }) {
  const def = KIND_BY_ID[kind];
  const selected = def.subtypes.find((s) => s.id === applied.cat || s.children?.some((c) => c.id === applied.cat)) ?? null;
  const hidden = def.subtypes.length > def.firstRow;
  const [more, setMore] = useState(() => !!selected && def.subtypes.indexOf(selected) >= def.firstRow);
  const shown = more || !hidden ? def.subtypes : def.subtypes.slice(0, def.firstRow);
  const href = (cat: string | null) => filterHref({ ...applied, cat, attrs: cat === applied.cat ? applied.attrs : applied.attrs });
  return (
    <nav aria-label={`${def.label} 세부 종류`} className="sub-nav">
      <ul className="tabs sub-chips">
        <li><Link href={href(null)} scroll={false} className={!applied.cat ? "on" : undefined} aria-current={!applied.cat ? "page" : undefined}>전체</Link></li>
        {shown.map((s) => {
          const on = selected?.id === s.id;
          const n = counts[s.id] ?? 0;
          return <li key={s.id}><Link href={href(s.id)} scroll={false} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>{s.label}{n > 0 && <span className="cnt">{n}</span>}</Link></li>;
        })}
        {hidden && !more && <li><button type="button" className="chip-more" onClick={() => setMore(true)}>더보기 +{def.subtypes.length - def.firstRow}</button></li>}
      </ul>
      {selected?.children && (
        <ul className="tabs sub-chips sub" aria-label={`${selected.label} 세부`}>
          <li><Link href={href(selected.id)} scroll={false} className={applied.cat === selected.id ? "on" : undefined}>{selected.label} 전체</Link></li>
          {selected.children.map((c) => <li key={c.id}><Link href={href(c.id)} scroll={false} className={applied.cat === c.id ? "on" : undefined}>{c.label}{(counts[c.id] ?? 0) > 0 && <span className="cnt">{counts[c.id]}</span>}</Link></li>)}
        </ul>
      )}
    </nav>
  );
}
