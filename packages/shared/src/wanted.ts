/**
 * "없는 술 요청" — 사용자가 찾았는데 카탈로그에 없던 이름을 한곳에 모은다(2026-09-20, docs/11 §5-8 3번 방법).
 * 모으는 곳: ① 결과가 없던 검색어(search_logs kind=search_empty) ② 식당 메뉴판·운영자 확인 정보에 적힌 술 이름
 *           (place_info.drink_names·drink_items — 카탈로그에 없어 이름 그대로 남은 것) ③ 회원픽 글의 술 이름.
 * 이름이 카탈로그에 이미 있으면 뺀다(목록을 넓히면 저절로 사라진다). 음식 이름·너무 짧은 말·지역 이름도 뺀다.
 */
export type WantedSource = "search" | "menu" | "pick";
export type WantedInput = { name: string; source: WantedSource; count?: number; at?: string | null; where?: string | null };
export type WantedRow = {
  name: string; total: number; score: number;
  by: Record<WantedSource, number>;
  places: string[];          // 메뉴판에 적힌 식당 이름 (최대 5)
  lastAt: string | null;
};

/** 출처마다 무게 — 식당이 실제로 팔고 있으면 가장 확실한 신호 */
const WEIGHT: Record<WantedSource, number> = { menu: 3, pick: 2, search: 1 };
const key = (s: string) => (s || "").toLowerCase().replace(/\s+/g, "").replace(/[^0-9a-z가-힣]/g, "");
/** 술 이름으로 보기 어려운 말 — 검색어에서 자주 나오는 잡음 */
const NOISE = /^(막걸리|전통주|약주|청주|소주|증류주|과실주|와인|맥주|안주|추천|선물|술|맛집|페어링|배송|무료|가격|도수|주문|구매|근처|주변)$/;

export function buildWantedList(
  inputs: WantedInput[],
  catalog: { name: string; alias?: string | null }[],
  foods: { name: string; alias?: string[] | null }[] = [],
  opts: { min?: number; limit?: number } = {},
): WantedRow[] {
  const known = new Set<string>();
  for (const d of catalog) { known.add(key(d.name)); if (d.alias) known.add(key(d.alias)); }
  const foodKeys = new Set<string>();
  for (const f of foods) { foodKeys.add(key(f.name)); for (const a of f.alias ?? []) foodKeys.add(key(a)); }

  const rows = new Map<string, WantedRow>();
  for (const x of inputs) {
    const name = (x.name || "").replace(/\s+/g, " ").trim();
    const k = key(name);
    if (k.length < 2 || known.has(k) || foodKeys.has(k) || NOISE.test(k)) continue;
    // 카탈로그 이름이 이 말을 품고 있으면 이미 있는 술(예: "소곡주" ⊂ "한산소곡주")
    if (k.length >= 3 && [...known].some((n) => n.includes(k))) continue;
    const r = rows.get(k) ?? { name, total: 0, score: 0, by: { search: 0, menu: 0, pick: 0 }, places: [], lastAt: null };
    const n = Math.max(1, x.count ?? 1);
    r.total += n;
    r.by[x.source] += n;
    r.score += n * WEIGHT[x.source];
    if (x.where && r.places.length < 5 && !r.places.includes(x.where)) r.places.push(x.where);
    if (x.at && (!r.lastAt || x.at > r.lastAt)) r.lastAt = x.at;
    if (name.length > r.name.length) r.name = name;   // 더 긴 표기를 대표 이름으로
    rows.set(k, r);
  }
  const min = opts.min ?? 1;
  return [...rows.values()].filter((r) => r.total >= min)
    .sort((a, b) => b.score - a.score || b.total - a.total || a.name.localeCompare(b.name, "ko"))
    .slice(0, opts.limit ?? 200);
}

/** 찾아볼 곳 — 운영자가 바로 눌러 확인한다 */
export const wantedLinks = (name: string) => ({
  thesool: `https://thesool.com/front/find/M000000082/list.do?searchKeyword=${encodeURIComponent(name)}`,
  yosool: `https://www.yosool.co.kr/search/keyword.do?searchText=${encodeURIComponent(name)}`,
  naver: `https://search.naver.com/search.naver?query=${encodeURIComponent(`${name} 전통주`)}`,
});
