/**
 * 카탈로그 사진 주소 규칙(2026-09-26) — 술(0009)·음식(0037) 사진은 어드민이 주소로 넣는다.
 * https 절대 주소 또는 사이트 안 경로(/demo/… 같은 것)만, 300자, 공백·따옴표·꺾쇠 금지(HTML 속성에 그대로 들어간다).
 * 사용 허락을 받은 사진만 넣는 것은 사람의 몫 — 더술닷컴(aT) 사진은 공공누리 4유형이라 쓰지 않는다.
 */
export const IMAGE_URL_MAX = 300, IMAGE_CREDIT_MAX = 80;
export function cleanCatalogImage(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s.length > IMAGE_URL_MAX || /[\s"'<>]/.test(s)) return "";
  return /^(https:\/\/[^/]+\/\S+|\/[^/\s]\S*)$/.test(s) ? s : "";
}
/** 출처·저작권 표시("복순도가 제공") — 한 줄 80자 */
export function cleanImageCredit(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, IMAGE_CREDIT_MAX);
}
