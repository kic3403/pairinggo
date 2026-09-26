"use client";
/**
 * 매장 메뉴판(2026-09-19 → 2026-09-27 탭) — 파트너가 채운 메뉴를 **음식 · 주류 · 음료** 탭으로 보여 준다(사용자 요청).
 * 주류 탭은 종류를 적은 술을 주종(전통주·위스키·사케·와인)별로 묶고, 종류가 없는 술은 맨 뒤 "술"로. 묶는 규칙은 shared groupMenuBoard.
 * 한 줄 = [사진] 이름 / 설명(술은 "종류 · 750ml · 13%") … 가격. 사진·빈칸은 적힌 것만 보인다(지어내지 않음).
 * 식당 카드의 "메뉴판 보기"와 예약 화면이 함께 쓴다. 비어 있는 탭은 안 보이고, 탭이 하나면 탭 줄을 생략한다.
 */
import { useState } from "react";
import { categoryLabelOf, formatAbv, formatPrice, groupMenuBoard, type DrinkItem, type MenuItem } from "@pairinggo/shared/menu-items";

type Row = { key: string; name: string; sub: string; price: number | null; img?: string };
type TabKey = "food" | "drink" | "beverage";
const TAB_LABEL: Record<TabKey, string> = { food: "음식", drink: "주류", beverage: "음료" };

function Rows({ rows }: { rows: Row[] }) {
  const photos = rows.some((r) => r.img);
  return (
    <ul className={`mb-list${photos ? " has-photos" : ""}`}>
      {rows.map((r) => (
        <li key={r.key} className="mb-row">
          {photos ? (r.img ? <img className="mb-img" src={r.img} alt={r.name} loading="lazy" decoding="async" width={72} height={72} /> : <span className="mb-img empty" aria-hidden="true" />) : null}
          <div className="mb-body">
            <span className="nm">{r.name}</span>
            {r.sub ? <span className="ds">{r.sub}</span> : null}
          </div>
          <span className="mb-price">{formatPrice(r.price)}</span>
        </li>
      ))}
    </ul>
  );
}
const foodRows = (items: MenuItem[], p: string): Row[] => items.map((m, i) => ({ key: `${p}${i}-${m.name}`, name: m.name, sub: m.desc, price: m.price, img: m.img }));
// 양조장·리쿼샵이 적은 술 설명이 있으면 용량·도수 앞에 보여 준다(2026-09-21)
const drinkRows = (items: DrinkItem[], p: string): Row[] => items.map((d, i) => ({
  key: `${p}${i}-${d.name}-${d.volume}`, name: d.name,
  sub: [categoryLabelOf(d.category), d.desc, [d.volume, formatAbv(d.abv)].filter(Boolean).join(" · ")].filter(Boolean).join(" · "),
  price: d.price, img: d.img,
}));

export default function MenuBoard({ menu, drinks }: { menu: MenuItem[]; drinks: DrinkItem[] }) {
  const g = groupMenuBoard(menu, drinks);
  const counts: Record<TabKey, number> = { food: g.food.length, drink: drinks.length, beverage: g.beverage.length };
  const tabs = (["food", "drink", "beverage"] as TabKey[]).filter((k) => counts[k] > 0);
  const [tab, setTab] = useState<TabKey>(tabs[0] ?? "food");
  if (!tabs.length) return null;
  const cur = tabs.includes(tab) ? tab : tabs[0];
  return (
    <div className="menu-board">
      {tabs.length > 1 && (
        <div className="mb-tabs" role="tablist" aria-label="메뉴판 구분">
          {tabs.map((k) => <button key={k} type="button" role="tab" aria-selected={cur === k} className={cur === k ? "on" : undefined} onClick={() => setTab(k)}>{TAB_LABEL[k]}<span className="cnt">{counts[k]}</span></button>)}
        </div>
      )}
      {cur === "food" && <section className="mb-sec" aria-label="음식">{tabs.length === 1 && <h4>음식 <span>{counts.food}</span></h4>}<Rows rows={foodRows(g.food, "f")} /></section>}
      {cur === "beverage" && <section className="mb-sec" aria-label="음료">{tabs.length === 1 && <h4>음료 <span>{counts.beverage}</span></h4>}<Rows rows={foodRows(g.beverage, "b")} /></section>}
      {cur === "drink" && g.drinks.map((grp) => (
        <section key={grp.kind} className="mb-sec" aria-label={grp.label}>
          {(g.drinks.length > 1 || tabs.length === 1) && <h4>{grp.label} <span>{grp.rows.length}</span></h4>}
          <Rows rows={drinkRows(grp.rows, `d-${grp.kind}-`)} />
        </section>
      ))}
      <p className="small muted">매장이 올린 메뉴판이에요. 가격·구성은 바뀔 수 있어요.</p>
    </div>
  );
}

/** 카드 "메뉴판 보기" 옆 작은 사진 줄 — 사진이 있는 매장만(최대 4장) */
export function MenuThumbs({ menu, drinks }: { menu: MenuItem[]; drinks: DrinkItem[] }) {
  const imgs = [...menu, ...drinks].filter((x) => x.img).slice(0, 4);
  if (!imgs.length) return null;
  return <span className="mb-thumbs" aria-hidden="true">{imgs.map((x, i) => <img key={i} src={x.img} alt="" loading="lazy" decoding="async" width={34} height={34} />)}</span>;
}
