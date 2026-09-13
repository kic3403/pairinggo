/**
 * 페어링의 '대중 언급 수'(pairings.blog_count) 규칙 — 네이버 블로그 검색 결과 수(total).
 * 원래 데이터를 거꾸로 맞춰 본 결과(2026-09-13 실측): 저장값 ≈ max(총수("{술 별칭} {음식}"), 총수("{술 이름} {음식}")).
 *   예) 가무치소주×광어회 저장 98 ↔ "가무치소주 광어회" 99 / "가무치소주 25도 광어회" 36
 *       골목막걸리×갈비탕 저장 16,912 ↔ "골목양조장 갈비탕" 1,292 / "골목막걸리 갈비탕" 17,042
 * 검색은 서버(apps/web/lib/blog-count.ts)·스크립트(packages/db blog-counts)가 하고, 여기서는 검색어만 만든다.
 */
export function blogCountQueries(drink: { name: string; alias?: string | null }, food: { name: string }): string[] {
  const f = food.name.trim();
  const qs = [drink.alias, drink.name].map((n) => (n || "").trim()).filter(Boolean).map((n) => `${n} ${f}`);
  return [...new Set(qs)];
}

/** 여러 검색어의 결과 수 중 가장 큰 값 — 검색 실패(null)는 건너뛰고, 전부 실패하면 null */
export function pickBlogCount(totals: (number | null | undefined)[]): number | null {
  const ok = totals.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0);
  return ok.length ? Math.max(...ok) : null;
}
