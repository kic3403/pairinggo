/**
 * 공개 웹 페이지 URL 슬러그 — 검색 유입이 목적이라 한글을 그대로 두고 공백만 하이픈으로 바꾼다.
 *   "복순도가 손막걸리" → "복순도가-손막걸리"  →  /술/복순도가-손막걸리
 * 조회는 slugKey로 비교한다(하이픈·기호·대소문자 무시). DB의 slug 컬럼과 같은 형태가 되어 그대로 맞춰볼 수 있다.
 */
export const toSlug = (name: string) =>
  (name || "").trim().replace(/\s+/g, "-").replace(/[^0-9A-Za-z가-힣-]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

/** 비교용 키 — 하이픈·기호를 지우고 소문자로 */
export const slugKey = (s: string) => {
  let v = s || "";
  try { v = decodeURIComponent(v); } catch { /* 이미 디코드된 값 */ }
  return v.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
};

/** 이름 목록에서 슬러그로 하나 찾기 */
export function findBySlug<T>(items: T[], slug: string, nameOf: (x: T) => string): T | undefined {
  const k = slugKey(slug);
  if (!k) return undefined;
  return items.find((x) => slugKey(nameOf(x)) === k);
}
