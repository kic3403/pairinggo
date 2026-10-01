/**
 * 유입 경로 분류(2026-10-02) — 방문이 어디서 왔는지: 검색·SNS·다른 사이트·직접.
 * 재료는 이미 쌓고 있던 첫 화면 기록의 `ref`(들어오기 직전 주소 — PageView가 문서마다 첫 화면에만 붙임)와 `q`(주소 뒤 ?… — utm_source가 여기 있다),
 * 그리고 `via`(앱 안 브라우저 표시 — 카카오톡·인스타는 직전 주소를 안 넘겨 주는 일이 많아 브라우저 정보로 알아낸다).
 * 주소 전체를 남기거나 보여 주지 않고 **묶음 이름**만 쓴다.
 */

export type TrafficGroup = "search" | "sns" | "share" | "site" | "direct" | "internal";
export type TrafficSource = { group: TrafficGroup; label: string };

export const TRAFFIC_GROUP_LABEL: Record<TrafficGroup, string> = { search: "검색", sns: "SNS·메신저", share: "공유 링크", site: "다른 사이트", direct: "직접·알 수 없음", internal: "사이트 안" };

/** 우리 주소·로그인 왕복 — 유입이 아니다 */
const OWN_HOST = /(^|\.)pairinggo\.(kr|com)$|^pairinggo(-[a-z0-9-]+)?\.vercel\.app$|^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/;
const LOGIN_HOST = /^(nid\.naver\.com|kauth\.kakao\.com|accounts\.kakao\.com|logins\.daum\.net|accounts\.google\.com|appleid\.apple\.com)$/;

const HOSTS: { re: RegExp; group: TrafficGroup; label: string }[] = [
  { re: /(^|\.)blog\.naver\.com$/, group: "sns", label: "네이버 블로그" },
  { re: /(^|\.)cafe\.naver\.com$/, group: "sns", label: "네이버 카페" },
  { re: /(^|\.)naver\.(com|me)$/, group: "search", label: "네이버" },
  { re: /(^|\.)google\.[a-z.]+$/, group: "search", label: "구글" },
  { re: /(^|\.)bing\.com$/, group: "search", label: "빙" },
  { re: /(^|\.)daum\.net$/, group: "search", label: "다음" },
  { re: /(^|\.)(duckduckgo\.com|yahoo\.com|yahoo\.co\.jp|zum\.com)$/, group: "search", label: "기타 검색" },
  { re: /(^|\.)instagram\.com$/, group: "sns", label: "인스타그램" },
  { re: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/, group: "sns", label: "페이스북" },
  { re: /(^|\.)threads\.(net|com)$/, group: "sns", label: "스레드" },
  { re: /(^|\.)(t\.co|x\.com|twitter\.com)$/, group: "sns", label: "X(트위터)" },
  { re: /(^|\.)(youtube\.com|youtu\.be)$/, group: "sns", label: "유튜브" },
  { re: /(^|\.)kakao\.com$/, group: "sns", label: "카카오톡" },
  { re: /(^|\.)tistory\.com$/, group: "sns", label: "티스토리" },
  { re: /(^|\.)(brunch\.co\.kr|velog\.io|medium\.com)$/, group: "sns", label: "블로그" },
];

/** utm_source 값 → 묶음. 우리가 붙이는 값: sns(SNS 글 복사)·kakao·share(공유 버튼)·rss */
const UTM: Record<string, TrafficSource> = {
  sns: { group: "sns", label: "SNS 글(우리 글 복사)" }, instagram: { group: "sns", label: "인스타그램" }, insta: { group: "sns", label: "인스타그램" },
  blog: { group: "sns", label: "블로그" }, naverblog: { group: "sns", label: "네이버 블로그" }, facebook: { group: "sns", label: "페이스북" }, youtube: { group: "sns", label: "유튜브" },
  kakao: { group: "share", label: "카카오톡 공유" }, share: { group: "share", label: "공유 버튼" }, rss: { group: "share", label: "RSS" },
  naver: { group: "search", label: "네이버" }, google: { group: "search", label: "구글" },
};
const VIA: Record<string, string> = { kakaotalk: "카카오톡 앱 안", instagram: "인스타그램 앱 안", naver: "네이버 앱 안", facebook: "페이스북 앱 안", line: "라인 앱 안", daum: "다음 앱 안" };

const hostOf = (ref: string) => { const m = /^https?:\/\/([^/?#]+)/i.exec(ref || ""); return m ? m[1].toLowerCase().replace(/^www\./, "") : ""; };
const utmOf = (q: string) => { const m = /[?&]utm_source=([^&#]*)/i.exec(q || ""); if (!m) return ""; try { return decodeURIComponent(m[1]).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30); } catch { return ""; } };

/** 브라우저 정보(User-Agent) → 앱 안 브라우저 표시. 일반 브라우저면 "" */
export function inAppOf(ua: string): string {
  const u = (ua || "").toLowerCase();
  if (u.includes("kakaotalk")) return "kakaotalk";
  if (u.includes("instagram")) return "instagram";
  if (u.includes("naver(inapp") || u.includes("naver/")) return "naver";
  if (u.includes("fban") || u.includes("fbav") || u.includes("fb_iab")) return "facebook";
  if (u.includes(" line/")) return "line";
  if (u.includes("daumapps")) return "daum";
  return "";
}

/** 첫 화면 기록 한 줄 → 유입 묶음. utm_source가 가장 먼저, 다음 직전 주소, 다음 앱 안 브라우저 */
export function trafficSource(p: { ref?: unknown; q?: unknown; via?: unknown }): TrafficSource {
  const utm = utmOf(typeof p.q === "string" ? p.q : "");
  if (utm) return UTM[utm] ?? { group: "share", label: `공유 링크(${utm})` };
  const host = hostOf(typeof p.ref === "string" ? p.ref : "");
  const via = typeof p.via === "string" ? VIA[p.via] : undefined;
  if (host) {
    if (OWN_HOST.test(host) || LOGIN_HOST.test(host)) return { group: "internal", label: TRAFFIC_GROUP_LABEL.internal };
    const hit = HOSTS.find((h) => h.re.test(host));
    if (hit) return { group: hit.group, label: hit.label };
    return { group: "site", label: host.slice(0, 40) };
  }
  if (via) return { group: "sns", label: via };
  return { group: "direct", label: TRAFFIC_GROUP_LABEL.direct };
}
