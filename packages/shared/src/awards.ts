/**
 * 식당 수상 배지 — 카카오 로컬 결과(이름·좌표)를 수상 표(미쉐린 등)와 대조한다.
 * 대조 규칙: 이름을 정규화(띄어쓰기·기호 제거, 소문자, 흔한 접미사 제거)해 같거나 한쪽이 다른 쪽을 포함하고,
 * 좌표가 있으면 300m 안이어야 한다. 좌표가 없는 행은 이름이 완전히 같을 때만.
 * "소울"·"산" 같은 짧은 이름이 엉뚱한 곳에 붙지 않도록 이름 2글자 이하는 완전 일치 + 좌표 일치를 요구한다.
 */
export type AwardKind = "star" | "bib" | "green" | "selected";
export type Award = { guide: string; year: number; city: string; name: string; kind: AwardKind; level: number; lat?: number | null; lng?: number | null; url?: string | null };
export type AwardBadge = { guide: string; year: number; kind: AwardKind; level: number; label: string; url?: string | null };

const SUFFIX = /(레스토랑|다이닝|본점|점|서울|부산|한남|청담|압구정|신사|성수)$/;
export function normalizePlaceName(s: string): string {
  let t = (s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[\s·\-_'’"“”.,&+]/g, "");
  if (t.length > 3) t = t.replace(/^레스토랑/, "").replace(SUFFIX, "");   // "레스토랑 산" ↔ "산", "우래옥 본점" ↔ "우래옥"
  return t;
}

const distM = (a: number, b: number, c: number, d: number) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

export const awardLabel = (a: Pick<Award, "guide" | "kind" | "level" | "year">) =>
  a.guide === "michelin"
    ? a.kind === "star" ? `미쉐린 ${"★".repeat(Math.max(1, Math.min(3, a.level)))} ${a.year}` : a.kind === "bib" ? `미쉐린 빕구르망 ${a.year}` : a.kind === "green" ? `미쉐린 그린스타 ${a.year}` : `미쉐린 셀렉티드 ${a.year}`
    : `${a.guide} ${a.year}`;

const RADIUS_M = 300;

/** 장소 하나에 붙일 배지(가장 높은 것 하나). 없으면 null */
export function matchAward(place: { name: string; lat?: number | null; lng?: number | null }, awards: Award[]): AwardBadge | null {
  const pn = normalizePlaceName(place.name);
  if (!pn) return null;
  let best: Award | null = null;
  for (const a of awards) {
    const an = normalizePlaceName(a.name);
    if (!an) continue;
    const exact = pn === an;
    const partial = !exact && pn.length >= 3 && an.length >= 3 && (pn.includes(an) || an.includes(pn));
    if (!exact && !partial) continue;
    const hasCoords = a.lat != null && a.lng != null && place.lat != null && place.lng != null;
    if (hasCoords) { if (distM(place.lat!, place.lng!, a.lat!, a.lng!) > RADIUS_M) continue; }
    else if (!exact) continue;
    if (an.length <= 2 && !(exact && hasCoords)) continue;
    if (!best || rank(a) > rank(best)) best = a;
  }
  return best ? { guide: best.guide, year: best.year, kind: best.kind, level: best.level, label: awardLabel(best), url: best.url ?? null } : null;
}
const rank = (a: Award) => (a.kind === "star" ? 10 + a.level : a.kind === "bib" ? 5 : a.kind === "green" ? 4 : 1);

/** 블루리본 서베이는 데이터 계약 전이라 우리 화면에 표시하지 않고, 그쪽 검색으로 보낸다 */
export const blueRibbonSearchUrl = (name: string) => `https://www.bluer.co.kr/search?query=${encodeURIComponent(name)}`;
