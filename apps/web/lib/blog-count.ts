/**
 * 페어링 대중 언급 수 — 네이버 블로그 검색 결과 수(total). 규칙은 packages/shared/src/pairing/blog-count.ts.
 * 어드민 승격으로 새 페어링을 만들 때 부른다(예전에는 0으로 넣어 '대중' 점수가 비었다, 2026-09-13).
 * 키가 없거나 검색이 실패하면 null — 호출부는 0으로 두고 나중에 `pnpm --filter @pairinggo/db blog-counts`로 채운다.
 */
import { blogCountQueries, pickBlogCount } from "@pairinggo/shared";

async function naverTotal(query: string): Promise<number | null> {
  const id = process.env.NCP_API_KEY_ID, key = process.env.NCP_API_KEY;
  const oid = process.env.NAVER_CLIENT_ID, okey = process.env.NAVER_CLIENT_SECRET;
  const qs = `query=${encodeURIComponent(query)}&display=1`;
  const req: { url: string; headers: Record<string, string> } | null = id && key
    ? { url: `https://naverapihub.apigw.ntruss.com/search/v1/blog?${qs}`, headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": key } }
    : oid && okey
      ? { url: `https://openapi.naver.com/v1/search/blog.json?${qs}`, headers: { "X-Naver-Client-Id": oid, "X-Naver-Client-Secret": okey } }
      : null;
  if (!req) return null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(req.url, { headers: req.headers, signal: AbortSignal.timeout(8000) });
      if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 700 * (i + 1))); continue; }
      if (!r.ok) return null;
      const j = (await r.json()) as { total?: number };
      return typeof j.total === "number" ? j.total : null;
    } catch { await new Promise((s) => setTimeout(s, 700 * (i + 1))); }
  }
  return null;
}

export async function countPairBlog(drink: { name: string; alias?: string | null }, food: { name: string }): Promise<number | null> {
  const qs = blogCountQueries(drink, food);
  const totals = await Promise.all(qs.map(naverTotal));
  return pickBlogCount(totals);
}
