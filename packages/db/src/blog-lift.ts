/**
 * 대중 언급 lift 계산(2026-09-27, docs/26 §3-3) — pairings.blog_lift(0~1 백분위)를 채운다. 규칙: shared pairing/blog-count.ts liftScores
 *   pnpm --filter @pairinggo/db blog-lift [--refresh] [--dry]
 *     술 이름 단독 수와 종류 기준 수("막걸리"·"막걸리 {음식}")를 name_totals에 모아(30일 지난 것만 다시, --refresh면 전부)
 *     "이 술 글에서 그 음식 비율 ÷ 같은 종류 글에서 그 음식 비율"의 백분위를 저장. 술 이름은 언급 수를 셀 때와 같은 이름들 중 단독 수가 큰 값. 끝나면 db:export.
 */
import { blogBaseWord, blogCountNames, blogNameUsable, liftScores } from "@pairinggo/shared";
import { naverConfigured, naverTotal } from "./naver-blog";
import { connect } from "./sql";

if (!naverConfigured()) { console.error("[blog-lift] 네이버 검색 키가 없습니다."); process.exit(2); }
const refresh = process.argv.includes("--refresh"), dry = process.argv.includes("--dry");
const sql = connect();
try {
  const rows = await sql<{ id: number; blog_count: number; dname: string; alias: string[] | null; kind: string | null; category: string; fname: string }[]>`
    select p.id, p.blog_count, d.name dname, d.alias, d.kind, d.category, f.name fname from pairings p join drinks d on d.id = p.drink_id join foods f on f.id = p.food_id
    where p.status <> 'hidden' and not d.is_demo`;
  const drinkNames = [...new Set(rows.flatMap((r) => blogCountNames({ name: r.dname, alias: r.alias?.[0] ?? null })))];
  const baseOf = (r: (typeof rows)[number]) => blogBaseWord({ kind: r.kind, category: r.category });
  const baseWords = [...new Set(rows.map(baseOf))];
  const basePairs = [...new Set(rows.filter((r) => (r.blog_count ?? 0) >= 3).map((r) => `${baseOf(r)} ${r.fname}`))];
  const cached = new Map<string, number | null>();
  for (const r of await sql<{ kind: string; name: string; total: string | null }[]>`select kind, name, total from name_totals where ${refresh ? sql`false` : sql`checked_on > current_date - 30`}`) cached.set(`${r.kind}|${r.name}`, r.total == null ? null : Number(r.total));
  const todo = [...drinkNames.map((n) => ["drink", n] as const), ...baseWords.map((n) => ["base", n] as const), ...basePairs.map((n) => ["base", n] as const)].filter(([k, n]) => !cached.has(`${k}|${n}`));
  console.log(`이름 단독 수 — 캐시 ${cached.size} · 새로 검색 ${todo.length}`);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length) {
      const [k, n] = todo[i++];
      const t = await naverTotal(n);
      cached.set(`${k}|${n}`, t);
      if (!dry && t != null) await sql`insert into name_totals (kind, name, total, checked_on) values (${k}, ${n}, ${t}, current_date) on conflict (kind, name) do update set total = excluded.total, checked_on = excluded.checked_on`;
    }
  }));
  const tot = (k: string, n: string) => cached.get(`${k}|${n}`) ?? null;
  const input = rows.map((r) => {
    const names = blogCountNames({ name: r.dname, alias: r.alias?.[0] ?? null }, (n) => blogNameUsable(tot("drink", n)));
    const dt = names.map((n) => tot("drink", n)).filter((x): x is number => typeof x === "number");
    return { id: r.id, pair: r.blog_count ?? 0, drinkTotal: dt.length ? Math.max(...dt) : null, basePair: tot("base", `${baseOf(r)} ${r.fname}`), baseTotal: tot("base", baseOf(r)) };
  });
  const lift = liftScores(input);
  const vals = [...lift.values()];
  console.log(`lift — 계산 ${vals.filter((v) => typeof v === "number" && v > 0).length} · 3건 미만 0 ${vals.filter((v) => v === 0).length} · 단독 수 모름 ${vals.filter((v) => v == null).length}`);
  const top = input.filter((x) => x.pair >= 3).sort((a, b) => b.pair - a.pair).slice(0, 8);
  const label = new Map(rows.map((r) => [r.id, `${r.dname} × ${r.fname}`]));
  for (const x of top) console.log(`  언급 ${x.pair.toLocaleString()} (술 단독 ${x.drinkTotal?.toLocaleString()} · 종류 기준 ${x.basePair?.toLocaleString()}/${x.baseTotal?.toLocaleString()}) → lift ${lift.get(x.id)} — ${label.get(x.id)}`);
  const best = input.filter((x) => (lift.get(x.id) ?? 0) >= 0.98).slice(0, 8);
  for (const x of best) console.log(`  ▲ 유난히 같이 나옴: 언급 ${x.pair} (술 단독 ${x.drinkTotal}) — ${label.get(x.id)}`);
  if (!dry) {
    const ids = [...lift.keys()] as number[];
    for (let s = 0; s < ids.length; s += 500) {
      const chunk = ids.slice(s, s + 500);
      await sql`update pairings p set blog_lift = v.l::real from (select unnest(${sql.array(chunk)}::bigint[]) id, unnest(${sql.array(chunk.map((id) => lift.get(id) ?? null) as never[])}::real[]) l) v where p.id = v.id`;
    }
    console.log(`저장 ${ids.length}건 — 이어서 pnpm --filter @pairinggo/db export`);
  }
} finally { await sql.end(); }
