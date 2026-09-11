/**
 * 채널별 언급량 수집 — "요즘 많이 찾는 전통주"의 원자료. 매일 00:00(KST) 크론(/api/cron/mentions)이 부른다.
 *
 * 채널과 세는 방법(모두 "최근 30일에 올라온 글·영상 수"):
 *  - naver   네이버 블로그 검색(API HUB) sort=date로 넘기며 postdate가 30일 안인 글을 센다. 상한 1,000(API가 start≤1000까지만).
 *  - youtube 유튜브 Data API search.list publishedAfter=30일 전. 한 페이지 50건, 꽉 차면 한 페이지 더(상한 100). 검색 1회 = 할당량 100(일 10,000) → 하루 절반씩.
 *  - google  구글 Programmable Search(JSON API) dateRestrict=m1의 totalResults(추정치). 무료 100회/일 → 하루 절반씩. 검색엔진(cx)은 블로그 도메인으로 제한해 둔다(docs/11).
 *  - insta   공식 API로 해시태그 게시물 수를 매일 받을 수 없다(그래프 API는 비즈니스 계정+앱 심사, 게시물 수 미제공; 크롤링은 약관 위반).
 *            → 수동 입력(`pnpm --filter @pairinggo/db mentions:insta 파일.csv`). 값이 있으면 그대로 평균에 들어간다.
 * 점수·순위 계산은 packages/shared/src/trend.ts.
 */
import { isDrinkMention, type Drink, type MentionChannel } from "@pairinggo/shared";

export const WINDOW_DAYS = 30;
/** 채널별 동시 요청 수 — 유튜브·구글은 초당 제한(429)이 빡빡하다 */
const CONCURRENCY: Record<MentionChannel, number> = { naver: 5, youtube: 2, google: 2, insta: 1 };
/** 별칭이 일반 단어와 겹치는 술의 검색어 — 실측(2026-09-12): "화요" 122,825건(화요일) vs "화요 소주" 3,920건, "예담" 113,065 vs "국순당 예담" 178 */
const QUERY_OVERRIDE: Record<string, string> = { d21: "화요 소주", d43: "국순당 예담" };

export type Collected = { drinkId: string; channel: MentionChannel; count: number; capped: boolean; query: string; raw?: Record<string, unknown> };

/** KST 기준 오늘(YYYY-MM-DD) */
export const todayKst = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 검색어 — 별칭(짧은 이름)이 있으면 그걸로. 일반 명사와 겹치는 술(generic)은 호출부에서 제외한다 */
export const queryOf = (d: Drink) => QUERY_OVERRIDE[d.id] ?? (d.alias || d.name).trim();
/** 언급 판정에 쓰는 이름들 */
export const termsOf = (d: Drink) => [d.alias, d.name].filter((x): x is string => !!x);
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;|&#39;|&amp;|&lt;|&gt;/g, " ");

const naverKeys = () => {
  const id = process.env.NCP_API_KEY_ID, key = process.env.NCP_API_KEY;
  if (id && key) return { hub: true as const, id, key };
  const oid = process.env.NAVER_CLIENT_ID, okey = process.env.NAVER_CLIENT_SECRET;   // 구 개발자센터 키, 2027-06까지
  if (oid && okey) return { hub: false as const, id: oid, key: okey };
  return null;
};
export const channelEnabled = (c: MentionChannel) =>
  c === "naver" ? !!naverKeys() : c === "youtube" ? !!process.env.YOUTUBE_API_KEY : c === "google" ? !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) : false;

/** retry429: 네이버의 429는 초당 제한이라 잠깐 쉬면 되지만, 구글 계열의 429는 일 할당량 소진이라 재시도해도 소용없다 */
async function getJson(url: string, headers: Record<string, string> = {}, tries = 3, retry429 = true): Promise<{ status: number; body: unknown }> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
      const body = await res.json().catch(() => null);
      if (((res.status === 429 && retry429) || res.status >= 500) && i < tries - 1) { await new Promise((r) => setTimeout(r, 1500 * 2 ** i)); continue; }
      return { status: res.status, body };
    } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

/* ---------- 네이버 블로그 ---------- */
export async function countNaverBlog(q: string, today: string, terms: string[]): Promise<Omit<Collected, "drinkId" | "channel">> {
  const k = naverKeys(); if (!k) throw new Error("네이버 키 없음");
  const cutoff = new Date(Date.parse(today + "T00:00:00Z") - (WINDOW_DAYS - 1) * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  let count = 0, total = 0, capped = false;
  for (let start = 1; start <= 901; start += 100) {
    const qs = `query=${encodeURIComponent(q)}&display=100&start=${start}&sort=date`;
    const { status, body } = k.hub
      ? await getJson(`https://naverapihub.apigw.ntruss.com/search/v1/blog?${qs}`, { "X-NCP-APIGW-API-KEY-ID": k.id, "X-NCP-APIGW-API-KEY": k.key })
      : await getJson(`https://openapi.naver.com/v1/search/blog.json?${qs}`, { "X-Naver-Client-Id": k.id, "X-Naver-Client-Secret": k.key });
    if (status !== 200) throw new Error(`naver ${status}`);
    const j = body as { total?: number; items?: { postdate?: string; title?: string; description?: string }[] };
    total = j.total ?? total;
    const items = j.items ?? [];
    const recent = items.filter((it) => (it.postdate ?? "") >= cutoff);
    count += recent.filter((it) => isDrinkMention(strip(`${it.title ?? ""} ${it.description ?? ""}`), terms)).length;
    if (recent.length < items.length || items.length < 100) break;   // 30일 밖 글이 나오기 시작했거나 마지막 페이지
    if (start === 901) capped = true;                                 // 1,000건 모두 30일 안 → 상한
  }
  return { count, capped, query: q, raw: { total } };
}

/* ---------- 유튜브 ---------- */
export async function countYoutube(q: string, today: string, terms: string[]): Promise<Omit<Collected, "drinkId" | "channel">> {
  const key = process.env.YOUTUBE_API_KEY; if (!key) throw new Error("유튜브 키 없음");
  const after = new Date(Date.parse(today + "T00:00:00Z") - (WINDOW_DAYS - 1) * 86400000).toISOString();
  let count = 0, capped = false, token = "", est: number | null = null;
  for (let page = 0; page < 2; page++) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(`"${q}"`)}&publishedAfter=${encodeURIComponent(after)}&relevanceLanguage=ko&regionCode=KR&key=${key}${token ? `&pageToken=${token}` : ""}`;
    const { status, body } = await getJson(url, {}, 3, false);
    if (status === 403 || status === 429) throw new Error(`youtube ${status} (일 할당량 초과 — 태평양시 자정=한국 16~17시에 초기화)`);
    if (status !== 200) throw new Error(`youtube ${status}`);
    const j = body as { items?: { snippet?: { title?: string; description?: string } }[]; nextPageToken?: string; pageInfo?: { totalResults?: number } };
    count += (j.items ?? []).filter((it) => isDrinkMention(`${it.snippet?.title ?? ""} ${it.snippet?.description ?? ""}`, terms)).length;
    est = j.pageInfo?.totalResults ?? est;
    if (!j.nextPageToken || (j.items ?? []).length < 50) break;
    token = j.nextPageToken;
    if (page === 1) capped = true;
  }
  if (count >= 100) capped = true;
  return { count, capped, query: q, raw: { estimated: est } };
}

/* ---------- 구글(블로그 도메인 한정 검색엔진) ---------- */
export async function countGoogle(q: string): Promise<Omit<Collected, "drinkId" | "channel">> {
  const key = process.env.GOOGLE_CSE_KEY, cx = process.env.GOOGLE_CSE_CX; if (!key || !cx) throw new Error("구글 키 없음");
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(`"${q}" (전통주 OR 막걸리 OR 소주 OR 술)`)}&dateRestrict=m1&num=1&gl=kr&lr=lang_ko`;
  const { status, body } = await getJson(url, {}, 3, false);
  if (status === 429 || status === 403) throw new Error(`google ${status} (일 할당량 초과)`);
  if (status !== 200) throw new Error(`google ${status}`);
  const j = body as { searchInformation?: { totalResults?: string } };
  const count = parseInt(j.searchInformation?.totalResults ?? "0", 10) || 0;
  return { count, capped: false, query: q, raw: { estimated: true } };
}

/** 동시성 제한 실행 — 채널이 할당량 오류를 내면 그 채널은 그 자리에서 멈춘다(다음 날 backfill) */
export async function collectChannel(channel: MentionChannel, drinks: Drink[], today: string, log: string[]): Promise<Collected[]> {
  const fn = channel === "naver" ? (q: string, t: string[]) => countNaverBlog(q, today, t) : channel === "youtube" ? (q: string, t: string[]) => countYoutube(q, today, t) : channel === "google" ? (q: string) => countGoogle(q) : null;
  if (!fn) return [];
  const out: Collected[] = [];
  let i = 0, stopped = false, fails = 0;
  const worker = async () => {
    while (i < drinks.length && !stopped) {
      const d = drinks[i++];
      try {
        const r = await fn(queryOf(d), termsOf(d));
        out.push({ drinkId: d.id, channel, ...r });
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("할당량")) { stopped = true; log.push(`${channel}: ${msg} — ${out.length}종에서 중단`); break; }
        if (++fails <= 5) log.push(`${channel} ${d.name}: ${msg}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY[channel] }, worker));
  return out;
}
