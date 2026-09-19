/**
 * 페어링의 '대중 언급 수'(pairings.blog_count) 규칙 — 네이버 블로그 검색 결과 수(total).
 * 원래 데이터를 거꾸로 맞춰 본 결과(2026-09-13 실측): 저장값 ≈ max(총수("{술 별칭} {음식}"), 총수("{술 이름} {음식}")).
 *   예) 가무치소주×광어회 저장 98 ↔ "가무치소주 광어회" 99 / "가무치소주 25도 광어회" 36
 *       골목막걸리×갈비탕 저장 16,912 ↔ "골목양조장 갈비탕" 1,292 / "골목막걸리 갈비탕" 17,042
 * 검색은 서버(apps/web/lib/blog-count.ts)·스크립트(packages/db blog-counts)가 하고, 여기서는 검색어만 만든다.
 */
export function blogCountQueries(drink: { name: string; alias?: string | null }, food: { name: string }): string[] {
  return [...new Set(blogCountNames(drink).map((n) => `${n} ${food.name.trim()}`))];
}

/** 언급 수에 쓸 술 이름들 (별칭 = 짧은 이름 먼저) — `usable`로 너무 흔한 이름을 걸러낸다 */
export function blogCountNames(drink: { name: string; alias?: string | null }, usable?: (name: string) => boolean): string[] {
  const names = [...new Set([drink.alias, drink.name].map((n) => (n || "").trim()).filter(Boolean) as string[])];
  return usable ? names.filter(usable) : names;
}

/**
 * 이름이 너무 흔하면 언급 수를 쓰지 않는다 (2026-09-20 실측).
 * 이름만으로 검색한 결과 수 — 제품다운 이름은 수천~수만(한산소곡주 29,282 · 지평막걸리 124,252 · 이도 42 13,954)인데
 * 일반 낱말과 겹치는 이름은 백만 단위(해 3.8억 · 이제 1.6억 · 달 7,273만 · 서울역 3,073만 · 우리막걸리 209만)라
 * "{이름} {음식}"으로 세면 그 술 이야기가 아닌 글이 잡힌다. 그런 이름은 검색어에서 빼고, 쓸 이름이 없으면 0으로 둔다.
 */
export const NAME_TOO_COMMON = 1_000_000;
export const blogNameUsable = (nameTotal: number | null | undefined) => !(typeof nameTotal === "number" && nameTotal > NAME_TOO_COMMON);

/**
 * 조합 언급 수는 그 이름 단독 언급 수를 넘을 수 없다 — "{이름} {음식}" 글은 "{이름}" 글의 일부이기 때문.
 * 네이버 검색이 이름을 쪼개 읽으면("설레온" 84건인데 "설레온 만두" 224,610건) 조합 쪽이 더 크게 나오므로 이름 쪽으로 자른다.
 */
export const capByNameTotal = (count: number | null | undefined, nameTotal: number | null | undefined) =>
  typeof count !== "number" ? null : typeof nameTotal === "number" ? Math.min(count, nameTotal) : count;

/** 여러 검색어의 결과 수 중 가장 큰 값 — 검색 실패(null)는 건너뛰고, 전부 실패하면 null */
export function pickBlogCount(totals: (number | null | undefined)[]): number | null {
  const ok = totals.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0);
  return ok.length ? Math.max(...ok) : null;
}
