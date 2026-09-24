"use client";
/**
 * 상세 필터 패널(2026-09-24, 요구사항 §11) — 모바일은 하단 시트, 640px 이상은 가운데 모달. RegionSheet(.rs-*)와 같은 뼈대(.fs-*).
 *  · 편집 중(draft)과 적용된 조건(URL)을 나눈다. "N개 결과 보기"를 눌러야 URL에 반영, 닫으면 편집 내용은 버린다.
 *  · 초기화는 상세 조건만 비우고 검색어·주종은 둔다(그 뒤 결과 보기로 적용).
 *  · 결과 수는 편집 중 조건으로 /api/v1/drinks/filter?count=1 을 0.25초 뒤에 부르고, 늦게 온 옛 응답은 버린다(seq).
 *  · 그룹 순서: 카테고리 → 가격 → 용량 → 음식 → 국가·지역 → 도수 → 맛·향 → 주종별 상세. 560px 이상은 왼쪽 그룹/오른쪽 설정, 그 아래는 한 열 아코디언.
 *  · 열면 제목에 초점, 닫으면 연 버튼으로 초점 복원(부모). ESC 닫기·배경 스크롤 잠금.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DRINK_KINDS, FOOD_FILTERS, KIND_BY_ID, KIND_LABEL, type AttrDef, type KindDef } from "@pairinggo/shared/kinds";
import { EMPTY_RANGE, ML_QUICK, ML_SLIDER, PRICE_QUICK, PRICE_SLIDER, filterChips, filterHref, rangeValid, resetDetails, sameRange, toSearchParams, type DrinkFilter, type Range } from "@pairinggo/shared/filter-url";

export type FilterGroup = "cat" | "price" | "ml" | "food" | "country" | "abv" | "flavor" | "attrs";
const GROUPS: { id: FilterGroup; label: string }[] = [
  { id: "cat", label: "카테고리" }, { id: "price", label: "가격" }, { id: "ml", label: "용량" }, { id: "food", label: "음식" },
  { id: "country", label: "국가·지역" }, { id: "abv", label: "도수" }, { id: "flavor", label: "맛·향" }, { id: "attrs", label: "상세 조건" },
];
const ABV_QUICK: { label: string; range: Range }[] = [
  { label: "전체", range: { min: null, max: null } }, { label: "9% 이하", range: { min: null, max: 9 } }, { label: "10~19%", range: { min: 10, max: 19 } }, { label: "20~39%", range: { min: 20, max: 39 } }, { label: "40% 이상", range: { min: 40, max: null } },
];

import RangeSlider from "./RangeSlider";

function SectionBox({ id, title, children, single, openGroup, setOpenGroup }: { id: FilterGroup; title: string; children: React.ReactNode; single: boolean; openGroup: FilterGroup; setOpenGroup: (g: FilterGroup) => void }) {
  const isOpen = !single || openGroup === id;
  return (
    <section className={`fs-sec${isOpen ? " open" : ""}`} data-group={id}>
      <h3><button type="button" onClick={() => setOpenGroup(id)} aria-expanded={isOpen} disabled={!single}>{title}<span className="fs-caret" aria-hidden>{single ? (isOpen ? "▴" : "▾") : ""}</span></button></h3>
      {isOpen && <div className="fs-sec-body">{children}</div>}
    </section>
  );
}
const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" className={`fchip${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>{children}</button>
);
function AttrField({ a, draft, setAttr, setDraft }: { a: AttrDef; draft: DrinkFilter; setAttr: (key: string, v: string, multi: boolean) => void; setDraft: React.Dispatch<React.SetStateAction<DrinkFilter>> }) {
  const cur = draft.attrs[a.key] || [];
  if (a.type === "bool") return <Chip on={cur.includes("1")} onClick={() => setAttr(a.key, "1", false)}>{a.label}</Chip>;
  if (a.type === "text") {
    return (
      <label className="fs-text"><span>{a.label}</span>
        <input value={cur[0] || ""} placeholder="포함할 낱말" onChange={(e) => setDraft((d) => { const attrs = { ...d.attrs }; const v = e.target.value.trim(); if (v) attrs[a.key] = [v]; else delete attrs[a.key]; return { ...d, attrs }; })} />
      </label>
    );
  }
  const opts = a.options ?? a.bands ?? [];
  const multi = a.type === "multi" || a.type === "tags" || a.type === "int" || a.type === "level";
  return (
    <div className="fs-attr">
      <p className="fs-attr-l">{a.label}</p>
      <div className="fchips">{opts.map((o) => <Chip key={o.id} on={cur.includes(o.id)} onClick={() => setAttr(a.key, o.id, multi)}>{o.label}</Chip>)}</div>
    </div>
  );
}

type Props = {
  open: boolean;
  /** 열 때 먼저 보일 그룹 */
  group: FilterGroup;
  applied: DrinkFilter;
  /** 지금 목록에 있는 맛 태그(많은 순) */
  flavors: string[];
  /** 지금 결과에 있는 용량(많은 순) — 자주 쓰는 용량 앞에 먼저 */
  volumes: number[];
  onClose: () => void;
};

export default function FilterSheet({ open, group, applied, flavors, volumes, onClose }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<DrinkFilter>(applied);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [single, setSingle] = useState(false);         // 좁은 화면 = 아코디언(한 그룹만 펼침)
  const [openGroup, setOpenGroup] = useState<FilterGroup>(group);
  const [mlMore, setMlMore] = useState(false);
  const seq = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 열 때 적용값으로 시작 + 그 그룹으로 스크롤 + 제목 초점
  useEffect(() => {
    if (!open) return;
    setDraft(applied); setOpenGroup(group); setMlMore(false);
    const t = setTimeout(() => {
      titleRef.current?.focus();
      bodyRef.current?.querySelector<HTMLElement>(`[data-group="${group}"]`)?.scrollIntoView({ block: "start" });
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 559px)");
    const sync = () => setSingle(mq.matches);
    sync(); mq.addEventListener("change", sync);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { mq.removeEventListener("change", sync); document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  // 결과 수 — 편집 중 조건으로, 늦게 온 옛 응답은 무시
  const valid = rangeValid(draft.price) && rangeValid(draft.ml) && rangeValid(draft.abv);
  useEffect(() => {
    if (!open || !valid) return;
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/v1/drinks/filter?${toSearchParams(draft).toString()}&count=1`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { total: number } | null) => { if (my !== seq.current) return; setCount(j ? j.total : null); setLoading(false); })
        .catch(() => { if (my === seq.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [open, draft, valid]);

  const kind: KindDef | null = draft.kind ? KIND_BY_ID[draft.kind] : null;
  const chips = useMemo(() => filterChips(draft), [draft]);
  const set = (patch: Partial<DrinkFilter>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const setAttr = (key: string, v: string, multi: boolean) => setDraft((d) => {
    const cur = d.attrs[key] || [];
    const next = multi ? toggleIn(cur, v) : cur.includes(v) ? [] : [v];
    const attrs = { ...d.attrs }; if (next.length) attrs[key] = next; else delete attrs[key];
    return { ...d, attrs };
  });
  const apply = () => { if (!valid) return; router.push(filterHref(draft)); onClose(); };
  const reset = () => setDraft(resetDetails(draft));
  const mlQuick = [...volumes, ...ML_QUICK.filter((v) => !volumes.includes(v))];   // 지금 결과에 있는 용량 먼저, 그다음 자주 쓰는 용량
  const mlShown = mlMore ? mlQuick : mlQuick.slice(0, 7);
  const exactMl = draft.ml.min != null && draft.ml.min === draft.ml.max ? draft.ml.min : null;
  const groups = GROUPS.filter((g) => g.id !== "attrs" || (kind && kind.attrs.some((a) => a.filter)));

  if (!open) return null;

  // 렌더마다 같은 컴포넌트를 쓰도록 모듈 수준 부품(SectionBox·Chip·AttrField)에 상태를 넘긴다 — 안에서 정의하면 매번 새 컴포넌트라 입력 초점이 날아간다
  const sec = { single, openGroup, setOpenGroup };

  return (
    <div className="rs-back" onClick={onClose} role="presentation">
      <section className="rs fs" role="dialog" aria-modal="true" aria-labelledby="fs-title" onClick={(e) => e.stopPropagation()}>
        <header className="rs-head">
          <h2 id="fs-title" ref={titleRef} tabIndex={-1}>필터{draft.kind ? <span className="muted"> · {KIND_LABEL[draft.kind]}</span> : ""}</h2>
          <button type="button" className="rs-x" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className="fs-cols">
          {!single && (
            <ul className="fs-nav" role="tablist" aria-label="필터 그룹">
              {groups.map((g) => (
                <li key={g.id}><button type="button" role="tab" aria-selected={openGroup === g.id} className={openGroup === g.id ? "on" : undefined}
                  onClick={() => { setOpenGroup(g.id); bodyRef.current?.querySelector<HTMLElement>(`[data-group="${g.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>{g.label}</button></li>
              ))}
            </ul>
          )}
          <div className="rs-body fs-body" ref={bodyRef}>
            <SectionBox {...sec} id="cat" title="카테고리">
              <div className="fchips">
                {[{ id: null as DrinkFilter["kind"], label: "전체" }, ...DRINK_KINDS.map((k) => ({ id: k.id as DrinkFilter["kind"], label: k.label }))].map((k) => (
                  <Chip key={k.id ?? "all"} on={draft.kind === k.id} onClick={() => setDraft((d) => (d.kind === k.id ? d : { ...d, kind: k.id, cat: null, attrs: {}, country: k.id ? d.country.filter((c) => KIND_BY_ID[k.id!].countries.some((x) => x.id === c)) : d.country }))}>{k.label}</Chip>
                ))}
              </div>
              {kind && (
                <div className="fchips" style={{ marginTop: 8 }}>
                  <Chip on={!draft.cat} onClick={() => set({ cat: null })}>{kind.label} 전체</Chip>
                  {kind.subtypes.map((s) => <Chip key={s.id} on={draft.cat === s.id || !!s.children?.some((c) => c.id === draft.cat)} onClick={() => set({ cat: s.id })}>{s.label}</Chip>)}
                </div>
              )}
              {kind && kind.subtypes.find((s) => s.id === draft.cat || s.children?.some((c) => c.id === draft.cat))?.children && (
                <div className="fchips sub" style={{ marginTop: 6 }}>
                  {kind.subtypes.find((s) => s.id === draft.cat || s.children?.some((c) => c.id === draft.cat))!.children!.map((c) => <Chip key={c.id} on={draft.cat === c.id} onClick={() => set({ cat: c.id })}>{c.label}</Chip>)}
                </div>
              )}
            </SectionBox>

            <SectionBox {...sec} id="price" title="가격">
              <RangeSlider label="가격" unit="원" base={PRICE_SLIDER.max} step={PRICE_SLIDER.step} value={draft.price} onChange={(price) => set({ price })} />
              <div className="fchips" style={{ marginTop: 8 }}>
                {PRICE_QUICK.map((q) => <Chip key={q.id} on={sameRange(draft.price, q.range)} onClick={() => set({ price: { ...q.range } })}>{q.label}</Chip>)}
              </div>
              <p className="small muted fs-note">참고가격은 해당 용량 <b>한 병</b> 기준, 배송비·쿠폰·회원 혜택 제외. 가격 조건을 걸면 가격이 확인된 술만 보입니다.</p>
            </SectionBox>

            <SectionBox {...sec} id="ml" title="용량">
              <RangeSlider label="용량" unit="mL" base={ML_SLIDER.max} step={ML_SLIDER.step} value={draft.ml} onChange={(ml) => set({ ml })} />
              <div className="fchips" style={{ marginTop: 8 }}>
                <Chip on={draft.ml.min == null && draft.ml.max == null} onClick={() => set({ ml: { ...EMPTY_RANGE } })}>전체</Chip>
                {mlShown.map((v) => <Chip key={v} on={exactMl === v} onClick={() => set({ ml: exactMl === v ? { ...EMPTY_RANGE } : { min: v, max: v } })}>{v.toLocaleString("ko-KR")}mL</Chip>)}
                {!mlMore && mlQuick.length > 7 && <button type="button" className="fchip more" onClick={() => setMlMore(true)}>더보기</button>}
              </div>
              <p className="small muted fs-note">한 병 기준입니다. 세트 상품은 한 병 필터에 섞지 않습니다. 용량 조건을 걸면 용량이 확인된 술만 보입니다.</p>
            </SectionBox>

            <SectionBox {...sec} id="food" title="어울리는 음식">
              <div className="fchips">{FOOD_FILTERS.map((x) => <Chip key={x.id} on={draft.food.includes(x.id)} onClick={() => set({ food: toggleIn(draft.food, x.id) })}>{x.label}</Chip>)}</div>
              <p className="small muted fs-note">등록된 페어링이 있는 술만 걸립니다.</p>
            </SectionBox>

            <SectionBox {...sec} id="country" title="국가·생산 지역">
              {kind ? (
                kind.countries.length > 1
                  ? <div className="fchips">{kind.countries.map((c) => <Chip key={c.id} on={draft.country.includes(c.id)} onClick={() => set({ country: toggleIn(draft.country, c.id) })}>{c.label}</Chip>)}</div>
                  : <p className="small muted">{kind.label}은 {kind.countries[0].label} 생산만 다룹니다.{kind.regionChips ? " 지역은 목록의 지역 칩에서 고르세요." : ""}</p>
              ) : <p className="small muted">주종을 먼저 고르면 그 주종의 생산 국가를 고를 수 있어요.</p>}
            </SectionBox>

            <SectionBox {...sec} id="abv" title="도수">
              <RangeSlider label="도수" unit="%" base={60} step={1} value={draft.abv} onChange={(abv) => set({ abv })} format={(n) => String(n)} />
              <div className="fchips" style={{ marginTop: 8 }}>{ABV_QUICK.map((q) => <Chip key={q.label} on={sameRange(draft.abv, q.range)} onClick={() => set({ abv: { ...q.range } })}>{q.label}</Chip>)}</div>
            </SectionBox>

            <SectionBox {...sec} id="flavor" title="맛·향">
              {flavors.length ? <div className="fchips">{flavors.map((t) => <Chip key={t} on={draft.flavor.includes(t)} onClick={() => set({ flavor: toggleIn(draft.flavor, t) })}>{t}</Chip>)}</div> : <p className="small muted">이 조건에는 맛 태그가 없습니다.</p>}
            </SectionBox>

            {kind && kind.attrs.some((a) => a.filter) && (
              <SectionBox {...sec} id="attrs" title={`${kind.label} 상세 조건`}>
                <div className="fs-attrs">{kind.attrs.filter((a) => a.filter).map((a) => <AttrField key={a.key} a={a} draft={draft} setAttr={setAttr} setDraft={setDraft} />)}</div>
              </SectionBox>
            )}
          </div>
        </div>

        <footer className="rs-foot fs-foot">
          {chips.length > 0 && (
            <ul className="fchips applied" aria-label="선택한 조건">
              {chips.map((c) => <li key={c.key}><button type="button" className="fchip on" onClick={() => setDraft(c.remove)} aria-label={`${c.label} 제거`}>{c.label} ✕</button></li>)}
            </ul>
          )}
          <div className="fs-actions">
            <button type="button" className="btn" onClick={reset}>초기화</button>
            <button type="button" className="btn p" onClick={apply} disabled={!valid} aria-busy={loading}>
              {!valid ? "조건을 확인해 주세요" : loading || count == null ? "결과 세는 중…" : `${count.toLocaleString("ko-KR")}개 결과 보기`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
