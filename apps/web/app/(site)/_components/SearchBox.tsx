"use client";
/**
 * 검색창 — 자바스크립트 없이도 동작하는 GET 폼. 헤더(compact)와 검색 페이지가 같이 쓴다.
 * 지역: 검색 페이지 폼에는 선택 상자(수도권은 서울·인천·경기도 묶음), 헤더는 관심지역을 숨은 값으로 보낸다.
 * URL에 지역이 있으면 그것, 없으면 관심지역(RegionProvider).
 *
 * 자동완성(2026-09-19 사용자 요청) — 치는 동안 아래에 후보가 뜬다.
 *  · 술·음식·종류/양조장: /api/v1/suggest(카탈로그만, 부분 일치·입력 중인 한글·초성). 0.12초 멈추면 부른다
 *  · 식당: /api/v1/places/search?lite=1(카카오) — 두 글자 이상, 0.4초 멈췄을 때만, 이름이 맞는 곳 3곳(없으면 키워드로 찾은 곳)
 *  · ↑↓ Enter로 고르고, 고르지 않고 Enter를 치면 지금처럼 검색 결과 화면으로 간다. Esc로 닫는다
 */
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { REGION_TREE, regionById, regionLabel, TOP_REGIONS } from "@pairinggo/shared/regions";
import { nameMatchedOrAll } from "@pairinggo/shared/places";
import { useHydrated, useRegion } from "./RegionProvider";
import { track } from "@/lib/track";

type Item = { type: "drink" | "food" | "browse" | "place"; id: string; name: string; meta: string; href: string };
type PlaceRow = { id: string; name: string; category: string; address: string; roadAddress: string; bookable?: boolean };
const TYPE_LABEL: Record<Item["type"], string> = { drink: "전통주", food: "음식", browse: "모아보기", place: "식당" };

export default function SearchBox({ initial = "", region = "", autoFocus = false, compact = false }: { initial?: string; region?: string; autoFocus?: boolean; compact?: boolean }) {
  const rg = useRegion();
  const hydrated = useHydrated();   // 하이드레이션 중에는 서버와 같은 값(전국)
  const router = useRouter();
  const listId = useId();
  const rid = region && region !== "all" ? region : hydrated ? rg.id : "all";
  const cur = regionById(rid);
  const known = TOP_REGIONS.some((r) => r.id === rid) || REGION_TREE.cap.some((s) => s.id === rid);

  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [places, setPlaces] = useState<Item[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const q = value.trim();

  // 술·음식 후보 — 짧게 멈추면
  useEffect(() => {
    if (!open || !q) { setItems([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/v1/suggest?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items: Item[] }) => { setItems(j.items ?? []); setActive(-1); })
        .catch(() => {});
    }, 120);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open]);

  // 식당 후보 — 두 글자 이상, 조금 더 멈추면(카카오 호출을 줄이려고)
  useEffect(() => {
    if (!open || q.length < 2) { setPlaces([]); setPlacesLoading(false); return; }
    const ctl = new AbortController();
    setPlacesLoading(true);
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q, lite: "1" });
      if (rid !== "all") p.set("region", rid);
      else if (hydrated && rg.gps) { p.set("lat", String(rg.gps.lat)); p.set("lng", String(rg.gps.lng)); }
      fetch(`/api/v1/places/search?${p}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { places: [] }))
        .then((j: { places?: PlaceRow[] }) => {
          const rows = nameMatchedOrAll(j.places ?? [], q).slice(0, 3);
          setPlaces(rows.map((x) => ({
            type: "place", id: x.id, name: x.name, href: `/places/${x.id}?n=${encodeURIComponent(x.name)}`,
            meta: [x.category, (x.roadAddress || x.address).split(" ").slice(0, 2).join(" "), x.bookable ? "예약 가능" : ""].filter(Boolean).join(" · "),
          })));
          setPlacesLoading(false); setActive(-1);
        })
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open, rid, hydrated, rg.gps]);

  const all = [...items, ...places];
  const show = open && q.length > 0 && (all.length > 0 || placesLoading);

  function go(it: Item, rank: number) {
    track("suggest_click", { type: it.type, rank, ...(it.type === "drink" ? { d: it.id } : it.type === "food" ? { f: it.id } : {}) });
    setOpen(false);
    router.push(it.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!show) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % all.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? all.length - 1 : a - 1)); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
    // 한글 입력 중의 Enter(글자 확정)는 고르기로 보지 않는다 — isComposing / keyCode 229가 표준 신호
    else if (e.key === "Enter" && active >= 0 && all[active] && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); go(all[active], active); }
  }

  return (
    <form action="/search" method="get" role="search" className={`sbox${compact ? " compact" : ""}`} onSubmit={() => setOpen(false)}>
      {compact
        ? <input type="hidden" name="region" value={rid === "all" ? "" : rid} />
        : (
          <select name="region" value={rid} onChange={(e) => rg.setRegion(e.target.value)} aria-label="지역" className="region">
            {TOP_REGIONS.map((r) => {
              const subs = REGION_TREE[r.id];
              return subs
                ? (
                  <optgroup key={r.id} label={r.label}>
                    <option value={r.id}>{r.label} 전체</option>
                    {subs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </optgroup>
                )
                : <option key={r.id} value={r.id}>{r.label}</option>;
            })}
            {/* 강남·수원처럼 세부 지역을 골라 둔 경우 — 그 항목을 그대로 보여 준다 */}
            {!known && cur && <option value={cur.id}>{regionLabel(cur)}</option>}
          </select>
        )}
      <div className="sbox-field">
        <input
          type="search" name="q" value={value} autoFocus={autoFocus}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={compact ? "술·음식·식당 검색" : "복순도가, 육회, 매운 안주에 어울리는 술, 식당 이름…"}
          aria-label="전통주·음식·식당 검색" autoComplete="off" maxLength={80}
          role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        />
        {show ? (
          <ul className="sbox-pop" id={listId} role="listbox" aria-label="검색 후보">
            {all.map((it, i) => (
              <li key={`${it.type}-${it.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                className={`${i === active ? "on" : ""}${i === items.length && i > 0 ? " sep" : ""}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => go(it, i)} onMouseEnter={() => setActive(i)}>
                <span className={`t t-${it.type}`}>{TYPE_LABEL[it.type]}</span>
                <span className="n">{it.name}</span>
                {it.meta ? <span className="m">{it.meta}</span> : null}
              </li>
            ))}
            {placesLoading && !places.length ? <li className="wait" aria-hidden="true">식당 찾는 중…</li> : null}
          </ul>
        ) : null}
      </div>
      <button type="submit" aria-label="검색">검색</button>
    </form>
  );
}
