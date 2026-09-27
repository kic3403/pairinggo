/**
 * 근거 검증 규칙(2026-09-27, docs/26 §3-3) — 링크가 살아 있고 인용문이 그 페이지에 실제로 있는지.
 * 가져오기(fetch)는 server/evidence-check.ts, 여기는 순수 판정만.
 *   · 인용문 대조: 띄어쓰기·문장부호를 뺀 글자에서 8자 조각(4자씩 겹침)의 절반 이상이 페이지에 있으면 있음 — 말줄임·조사 차이를 견딘다
 *   · 판정: 200 + 인용문 있음 → ok · 200 + 없음 → quote_missing · 404/410/연결 실패 → dead · 401/403/로그인·스크립트 화면 → blocked
 *   · 원래 못 읽는 곳(네이버 카페·공공데이터 목록·인스타 등)은 unverifiable — 벌점 없음
 *   · 무게: dead가 2번 연속이면 0(출처로 세지 않음), quote_missing이 2번 연속이면 절반. 한 번은 봐준다(일시 장애)
 */
export type LinkStatus = "ok" | "quote_missing" | "dead" | "blocked" | "unverifiable";
export const LINK_STATUSES: LinkStatus[] = ["ok", "quote_missing", "dead", "blocked", "unverifiable"];

/** 못 읽는 게 정상인 곳 — 로그인 필요·자료 목록·앱 전용 */
const UNVERIFIABLE = /(^|\.)(cafe\.naver\.com|data\.go\.kr|instagram\.com|facebook\.com|band\.us|kakao\.com)$/;
export function isUnverifiableHost(url: string): boolean {
  try { return UNVERIFIABLE.test(new URL(url).hostname.replace(/^www\./, "")); } catch { return true; }
}

/** 네이버 블로그는 본문이 iframe이라 모바일 주소로 읽는다 */
export function readableUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/^(www\.)?blog\.naver\.com$/.test(u.hostname)) {
      const seg = u.pathname.split("/").filter(Boolean);
      const id = u.searchParams.get("blogId") ?? seg[0], no = u.searchParams.get("logNo") ?? seg[1];
      if (id && no) return `https://m.blog.naver.com/${id}/${no}`;
    }
    return url;
  } catch { return url; }
}

const squash = (s: string) => (s || "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/[^가-힣a-z0-9]/g, "");

/** 인용문이 페이지 글자에 있나 — 8자 조각 절반 이상. 짧은 인용(8자 미만)은 통째로 */
export function quoteFound(quote: string | null | undefined, pageText: string): boolean | null {
  const q = squash(String(quote ?? "").replace(/[…]|\.\.\./g, " "));
  if (!q) return null;
  const t = squash(pageText);
  if (!t) return false;
  if (q.length < 8) return t.includes(q);
  const pieces: string[] = [];
  for (let i = 0; i + 8 <= q.length; i += 4) pieces.push(q.slice(i, i + 8));
  const hit = pieces.filter((p) => t.includes(p)).length;
  return hit / pieces.length >= 0.5;
}

/** 로그인·차단·빈 스크립트 화면으로 보이는 글자 */
const BLOCKED_TEXT = /(로그인이 필요|로그인 후 이용|접근이 제한|권한이 없습니다|robot|captcha|enable javascript|자바스크립트를 사용)/i;

/** 한 번 가져온 결과 → 상태 */
export function judgeFetch(input: { url: string; status: number | null; text: string; quote?: string | null }): { status: LinkStatus; quoteOk: boolean | null; note: string } {
  if (isUnverifiableHost(input.url)) return { status: "unverifiable", quoteOk: null, note: "읽을 수 없는 곳" };
  const s = input.status;
  if (s == null) return { status: "dead", quoteOk: null, note: "연결 실패" };
  if (s === 404 || s === 410) return { status: "dead", quoteOk: null, note: `HTTP ${s}` };
  if (s === 401 || s === 403 || s === 429 || s >= 500) return { status: "blocked", quoteOk: null, note: `HTTP ${s}` };
  if (s >= 400) return { status: "dead", quoteOk: null, note: `HTTP ${s}` };
  const plain = squash(input.text);
  // 로그인 벽·빈 스크립트 화면은 글자가 아주 적다 — 메뉴의 '로그인' 낱말만으로 막힘 판정을 내리지 않게 600자 기준(2026-09-27 네이버 블로그 오판 81건)
  if (plain.length < 200 || (BLOCKED_TEXT.test(input.text.slice(0, 5000)) && plain.length < 600)) return { status: "blocked", quoteOk: null, note: "본문을 읽지 못함(로그인·스크립트 화면)" };
  const q = quoteFound(input.quote, input.text);
  if (q === null) return { status: "ok", quoteOk: null, note: "인용문 없음(링크만 확인)" };
  return q ? { status: "ok", quoteOk: true, note: "" } : { status: "quote_missing", quoteOk: false, note: "인용문을 찾지 못함" };
}

/** 연속 실패 수 갱신 — ok·blocked·unverifiable이면 0으로(못 본 것은 벌점 대상이 아니다) */
export const nextFailCount = (prev: number, status: LinkStatus) => (status === "dead" || status === "quote_missing" ? prev + 1 : 0);

/** 근거 한 줄의 무게 배수 — 신뢰도 계산(confidence.ts)이 곱한다 */
export function evidenceFactor(e: { link_status?: string | null; fail_count?: number | null }): number {
  const n = e.fail_count ?? 0;
  if (e.link_status === "dead" && n >= 2) return 0;
  if (e.link_status === "quote_missing" && n >= 2) return 0.5;
  return 1;
}
