/** 검색창 — 자바스크립트 없이도 동작하는 GET 폼. 헤더(compact)와 검색 페이지가 같이 쓴다. 지역 옵션은 검색 페이지 폼에만(헤더는 고른 지역을 숨은 값으로 유지). */
import { TOP_REGIONS } from "@pairinggo/shared";

export default function SearchBox({ initial = "", region = "", autoFocus = false, compact = false }: { initial?: string; region?: string; autoFocus?: boolean; compact?: boolean }) {
  return (
    <form action="/search" method="get" role="search" className={`sbox${compact ? " compact" : ""}`}>
      {compact
        ? region && <input type="hidden" name="region" value={region} />
        : (
          <select name="region" defaultValue={region || "all"} aria-label="지역" className="region">
            {TOP_REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
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
