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

/**
 * 대중 언급 lift(2026-09-27, docs/26 §3-3) — "이 술 글에서 그 음식이 나오는 비율"을 "같은 종류 술 글 전체에서 그 음식이 나오는 비율"로 나눈 값의 백분위(0~1).
 * 왜: 조합 언급 수는 두 낱말이 한 글에 같이 나온 수라 흔한 이름일수록 커지고, 네이버 API는 따옴표 구절 검색을 무시해 이름을 쪼개 읽는다
 *   (신선막걸리 × 감자전 59,190 = '신선'+'막걸리'+'감자전' — 실측 "신선막걸리"와 신선막걸리가 같은 554,128).
 *   술 이름 단독 수로 나누면 인기 차이가, 같은 종류 기준(막걸리 × 감자전 ÷ 막걸리)으로 나누면 "막걸리는 원래 전과 잘 붙는다"는 종류 전체의 연관이 빠져
 *   그 술만의 연관만 남는다.
 * 규칙: 언급 3건 미만은 0(우연). ln((언급+1)/(술 단독+100)) − ln((종류 언급+1)/(종류 단독+100)) → 언급 3건 이상 조합 전체의 백분위.
 *   단독 수·종류 기준을 모르면 null(점수는 옛 로그 눈금으로 대신). 조합 언급이 술 단독 수의 절반을 넘으면 이름이 쪼개져 생긴 잡음으로 보고 null
 *   (실측: 오디랑 × 라멘 199 / 오디랑 202 — '오디'·'랑'으로 읽힘).
 */
export const LIFT_MIN_MENTIONS = 3;
export const LIFT_MAX_SHARE = 0.5;
/** 종류 기준 낱말 — 술 종류마다 블로그에서 가장 흔히 쓰는 말 */
export function blogBaseWord(d: { kind?: string | null; category?: string | null }): string {
  const k = d.kind ?? "trad", c = d.category ?? "";
  if (k === "whisky") return "위스키";
  if (k === "sake") return "사케";
  if (k === "wine") return "와인";
  if (/탁주|막걸리|동동주/.test(c)) return "막걸리";
  if (/약주|청주/.test(c)) return "약주";
  if (/증류|소주/.test(c)) return "소주";
  if (/과실|와인/.test(c)) return "와인";
  return "전통주";
}
export function liftScores(rows: { id: string | number; pair: number; drinkTotal: number | null; basePair: number | null; baseTotal: number | null }[]): Map<string | number, number | null> {
  const out = new Map<string | number, number | null>();
  const scored: { id: string | number; v: number }[] = [];
  for (const r of rows) {
    if (!(r.pair >= LIFT_MIN_MENTIONS)) { out.set(r.id, 0); continue; }
    if (r.drinkTotal == null || r.basePair == null || r.baseTotal == null || r.pair > r.drinkTotal * LIFT_MAX_SHARE) { out.set(r.id, null); continue; }
    scored.push({ id: r.id, v: Math.log((r.pair + 1) / (r.drinkTotal + 100)) - Math.log((r.basePair + 1) / (r.baseTotal + 100)) });
  }
  const sorted = [...scored].sort((a, b) => a.v - b.v);
  const n = sorted.length;
  let i = 0;
  while (i < n) {
    let j = i; while (j + 1 < n && sorted[j + 1].v === sorted[i].v) j++;
    const pct = Math.round(((j + 1) / n) * 1000) / 1000;
    for (let k = i; k <= j; k++) out.set(sorted[k].id, pct);
    i = j + 1;
  }
  return out;
}
