/** 검색창 — 자바스크립트 없이도 동작하는 GET 폼. 헤더와 검색 페이지가 같이 쓴다. */
export default function SearchBox({ initial = "", autoFocus = false, compact = false }: { initial?: string; autoFocus?: boolean; compact?: boolean }) {
  return (
    <form action="/search" method="get" role="search" className={`sbox${compact ? " compact" : ""}`}>
      <input
        type="search" name="q" defaultValue={initial} autoFocus={autoFocus}
        placeholder={compact ? "술·음식 검색" : "복순도가, 육회, 매운 안주에 어울리는 술…"}
        aria-label="전통주·음식 검색" autoComplete="off" maxLength={80}
      />
      <button type="submit" aria-label="검색">검색</button>
    </form>
  );
}
