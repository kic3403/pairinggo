"use client";
/**
 * 검색창 — 자바스크립트 없이도 동작하는 GET 폼. 헤더(compact)와 검색 페이지가 같이 쓴다.
 * 지역: 검색 페이지 폼에는 선택 상자(수도권은 서울·인천·경기도 묶음), 헤더는 관심지역을 숨은 값으로 보낸다.
 * URL에 지역이 있으면 그것, 없으면 관심지역(RegionProvider).
 */
import { REGION_TREE, regionById, regionLabel, TOP_REGIONS } from "@pairinggo/shared/regions";
import { useRegion } from "./RegionProvider";

export default function SearchBox({ initial = "", region = "", autoFocus = false, compact = false }: { initial?: string; region?: string; autoFocus?: boolean; compact?: boolean }) {
  const rg = useRegion();
  const rid = region && region !== "all" ? region : rg.id;
  const cur = regionById(rid);
  const known = TOP_REGIONS.some((r) => r.id === rid) || REGION_TREE.cap.some((s) => s.id === rid);
  return (
    <form action="/search" method="get" role="search" className={`sbox${compact ? " compact" : ""}`}>
      {compact
        ? rid !== "all" && <input type="hidden" name="region" value={rid} />
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
      <input
        type="search" name="q" defaultValue={initial} autoFocus={autoFocus}
        placeholder={compact ? "술·음식 검색" : "복순도가, 육회, 매운 안주에 어울리는 술…"}
        aria-label="전통주·음식 검색" autoComplete="off" maxLength={80}
      />
      <button type="submit" aria-label="검색">검색</button>
    </form>
  );
}
