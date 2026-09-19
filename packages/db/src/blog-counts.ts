/**
 * 페어링 대중 언급 수 채우기 — pairings.blog_count 가 0인 행을 네이버 블로그 검색 결과 수로 채운다.
 *   pnpm --filter @pairinggo/db blog-counts [--all] [--dry]
 *     기본: blog_count = 0 인 행만(공개·검수 중 모두)   --all: 전체를 다시 센다   --dry: 저장하지 않고 결과만
 * 규칙: max(총수("{술 별칭} {음식}"), 총수("{술 이름} {음식}")) — packages/shared/src/pairing/blog-count.ts
 * 이름만으로 검색한 결과가 100만 건을 넘는 흔한 이름(해·달·이제…)은 검색어에서 빼고, 쓸 이름이 없으면 0으로 둔다.
 * 검색이 실패한 행은 건드리지 않는다(0으로 덮어쓰지 않음). 끝나면 어드민에서 발행하거나 `pnpm db:export`.
 * 키: packages/db/.env 의 NCP_API_KEY_ID / NCP_API_KEY (없으면 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)
 */
import { blogCountNames, blogNameUsable, capByNameTotal, pickBlogCount } from "@pairinggo/shared";
import { connect } from "./sql";

const all = process.argv.includes("--all");
const dry = process.argv.includes("--dry");
const HUB_ID = process.env.NCP_API_KEY_ID, HUB_KEY = process.env.NCP_API_KEY;
const NID = process.env.NAVER_CLIENT_ID, NSEC = process.env.NAVER_CLIENT_SECRET;
if (!(HUB_ID && HUB_KEY) && !(NID && NSEC)) { console.error("[blog-counts] 네이버 검색 키가 없습니다 (packages/db/.env NCP_API_KEY_ID/NCP_API_KEY)."); process.exit(2); }

async function naverTotal(query: string): Promise<number | null> {
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

const sql = connect();
try {
  const rows = await sql<{ id: number; drink_id: string; food_id: string; blog_count: number; dname: string; alias: string[] | null; fname: string }[]>`
    select p.id, p.drink_id, p.food_id, p.blog_count, d.name as dname, d.alias, f.name as fname
    from pairings p join drinks d on d.id = p.drink_id join foods f on f.id = p.food_id
    where ${all ? sql`true` : sql`coalesce(p.blog_count, 0) = 0`} and p.status <> 'hidden'
    order by p.id`;
  console.log(`대상 ${rows.length}건 (${all ? "전체" : "blog_count 0"}${dry ? ", 저장 안 함" : ""})`);

  // 이름이 너무 흔하면(이름만 검색해 100만 건 초과) 그 이름으로는 세지 않는다 — "해 삼겹살" 같은 검색어가 다른 글을 잡는다
  const names = [...new Set(rows.flatMap((r) => blogCountNames({ name: r.dname, alias: r.alias?.[0] ?? null })))];
  const nameTotal = new Map<string, number | null>();
  let ni = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (ni < names.length) { const n = names[ni++]; nameTotal.set(n, await naverTotal(n)); }
  }));
  const usable = (n: string) => blogNameUsable(nameTotal.get(n));
  const tooCommon = names.filter((n) => !usable(n));
  if (tooCommon.length) console.log(`너무 흔한 이름 ${tooCommon.length}개는 검색어에서 뺍니다 — ${tooCommon.map((n) => `${n}(${nameTotal.get(n)?.toLocaleString()})`).join(", ")}`);

  const results: { id: number; label: string; before: number; after: number | null }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      const use = blogCountNames({ name: r.dname, alias: r.alias?.[0] ?? null }, usable);
      // 쓸 이름이 하나도 없으면 0 (부풀려진 값이 남지 않게 덮어쓴다)
      const totals = use.length ? [] as (number | null)[] : [0];
      for (const n of use) totals.push(capByNameTotal(await naverTotal(`${n} ${r.fname}`), nameTotal.get(n)));
      results.push({ id: r.id, label: `${r.dname} × ${r.fname}`, before: r.blog_count, after: pickBlogCount(totals) });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  const ok = results.filter((x) => x.after != null);
  const failed = results.length - ok.length;
  const changed = ok.filter((x) => x.after !== x.before);
  if (!dry && changed.length) {
    await sql.begin(async (tx) => {
      for (const x of changed) await tx`update pairings set blog_count = ${x.after!}, updated_at = now() where id = ${x.id}`;
    });
  }
  const nums = ok.map((x) => x.after!).sort((a, b) => a - b);
  console.log(`검색 성공 ${ok.length} · 실패 ${failed} · 값이 바뀐 행 ${changed.length}${dry ? " (저장 안 함)" : " 저장"}`);
  if (nums.length) console.log(`결과 분포: 0건 ${nums.filter((n) => n === 0).length} · 중앙값 ${nums[Math.floor(nums.length / 2)]} · 최대 ${nums[nums.length - 1]}`);
  for (const x of changed.sort((a, b) => b.after! - a.after!).slice(0, 12)) console.log(`  ${x.label}: ${x.before} → ${x.after}`);
} finally {
  await sql.end();
}
