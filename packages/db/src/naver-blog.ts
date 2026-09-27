/**
 * 네이버 블로그 검색 결과 수(total) — blog-counts·blog-lift가 함께 쓴다.
 * 키: packages/db/.env 의 NCP_API_KEY_ID / NCP_API_KEY (없으면 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET). 실패하면 null(0으로 덮지 않게)
 */
import "dotenv/config";
const HUB_ID = process.env.NCP_API_KEY_ID, HUB_KEY = process.env.NCP_API_KEY;
const NID = process.env.NAVER_CLIENT_ID, NSEC = process.env.NAVER_CLIENT_SECRET;
export const naverConfigured = () => !!((HUB_ID && HUB_KEY) || (NID && NSEC));

export async function naverTotal(query: string): Promise<number | null> {
  const qs = `query=${encodeURIComponent(query)}&display=1`;
  const url = HUB_ID && HUB_KEY ? `https://naverapihub.apigw.ntruss.com/search/v1/blog?${qs}` : `https://openapi.naver.com/v1/search/blog.json?${qs}`;
  const headers: Record<string, string> = HUB_ID && HUB_KEY ? { "X-NCP-APIGW-API-KEY-ID": HUB_ID, "X-NCP-APIGW-API-KEY": HUB_KEY } : { "X-Naver-Client-Id": NID!, "X-Naver-Client-Secret": NSEC! };
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 800 * (i + 1))); continue; }
      if (!r.ok) { console.warn(`  [naver ${r.status}] ${query}`); return null; }
      const j = (await r.json()) as { total?: number };
      return typeof j.total === "number" ? j.total : null;
    } catch { await new Promise((s) => setTimeout(s, 800 * (i + 1))); }
  }
  return null;
}
