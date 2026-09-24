"use client";
/**
 * 상세 화면 규격 선택(2026-09-24, 요구사항 §13) — 용량(·빈티지) 버튼을 고르면 그 규격의 참고가격·가격 유형·출처·확인일이 바뀐다.
 * 고른 규격은 URL ?spec= 에 남아 목록에서 온 규격이 유지되고, 공유 링크도 그 규격으로 열린다. 세트 규격은 따로 표시한다.
 * 가격은 페어링GO 판매가가 아니라 확인일 기준 참고가격 — 배송비·쿠폰 제외(사용자 결정 2026-09-24).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PRICE_BASIS_NOTE, PRICE_TYPE_LABEL, fmtKrw, fmtMl, specPrice } from "@pairinggo/shared/specs";
import type { DrinkSpec } from "@pairinggo/shared/filter-url";
import ExtLink from "./ExtLink";

export default function SpecPicker({ specs, drinkId }: { specs: DrinkSpec[]; drinkId: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const bottles = specs.filter((s) => s.pack === "bottle");
  const sets = specs.filter((s) => s.pack === "set");
  const fromUrl = sp.get("spec");
  const [sel, setSel] = useState<string>(() => (specs.some((s) => s.id === fromUrl) ? fromUrl! : bottles[0]?.id ?? specs[0]?.id ?? ""));
  useEffect(() => { if (fromUrl && specs.some((s) => s.id === fromUrl)) setSel(fromUrl); }, [fromUrl, specs]);
  if (!specs.length) return null;
  const cur = specs.find((s) => s.id === sel) ?? specs[0];
  const price = specPrice(cur);
  const label = (s: DrinkSpec) => [s.ml != null ? fmtMl(s.ml) : "용량 미확인", s.vintage, s.pack === "set" ? `${s.bottles}병 세트` : null].filter(Boolean).join(" · ");
  const choose = (id: string) => {
    setSel(id);
    const q = new URLSearchParams(sp.toString()); q.set("spec", id);
    router.replace(`${location.pathname}?${q.toString()}`, { scroll: false });
  };
  return (
    <section className="specbox" aria-labelledby="spec-title">
      <h3 id="spec-title">용량과 참고가격</h3>
      <div className="fchips" role="group" aria-label="규격">
        {bottles.map((s) => <button key={s.id} type="button" className={`fchip${s.id === cur.id ? " on" : ""}`} aria-pressed={s.id === cur.id} onClick={() => choose(s.id)}>{label(s)}</button>)}
        {sets.map((s) => <button key={s.id} type="button" className={`fchip set${s.id === cur.id ? " on" : ""}`} aria-pressed={s.id === cur.id} onClick={() => choose(s.id)}>{label(s)}</button>)}
      </div>
      <dl className="spec-kv">
        <div><dt>{cur.pack === "set" ? "세트 참고가격" : "참고가격"}</dt><dd className="price">{price ? fmtKrw(price.krw) : <span className="muted">가격 정보 없음</span>}</dd></div>
        {cur.abv != null && <div><dt>도수</dt><dd>{cur.abv}%</dd></div>}
        {cur.pack === "set" && <div><dt>구성</dt><dd>{cur.ml != null ? `${fmtMl(cur.ml)} × ${cur.bottles}병 (총 ${fmtMl(cur.ml * cur.bottles)})` : `${cur.bottles}병`}</dd></div>}
        {price && (
          <>
            <div><dt>가격 유형</dt><dd>{PRICE_TYPE_LABEL[price.type]}</dd></div>
            <div><dt>출처 · 확인일</dt><dd>{price.url ? <ExtLink href={price.url} event="external_link" props={{ d: drinkId, kind: "price_source" }}>{price.source} ↗</ExtLink> : price.source} · {price.checked}</dd></div>
          </>
        )}
        {cur.note && <div><dt>메모</dt><dd>{cur.note}</dd></div>}
      </dl>
      <p className="small muted" style={{ margin: "8px 0 0" }}>{PRICE_BASIS_NOTE}</p>
    </section>
  );
}
