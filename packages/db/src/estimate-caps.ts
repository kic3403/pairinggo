/**
 * 추정 조합 상한 적용(2026-09-27, docs/26 §3-3) — 규칙은 shared pairing/estimate-caps.ts(음식마다 맛 분석 상위 20 · 술마다 상위 5만 남김).
 *   pnpm --filter @pairinggo/db estimate-caps [--apply]   기본은 미리보기. --apply면 나머지 추정 조합을 status hidden으로 바꾸고 발행,
 *   숨긴 id를 research/estimate-caps/hidden-YYYY-MM-DD.json에 남긴다(되돌리기: 그 id들을 status 'curated'로).
 * 추정 = 근거 강도 0(confidence estimate). 회원이 '먹어봤어요'로 평가한 조합은 숨기지 않는다.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateCapPlan, evidenceStats, type SrcTier } from "@pairinggo/shared";
import { publishCatalog } from "./catalog-write";
import { connect } from "./sql";

const apply = process.argv.includes("--apply");
const sql = connect();
try {
  const rows = await sql<{ id: number; drink_id: string; food_id: string; source_tier: string; pf: number | null; ev: unknown[] | null; rated: boolean; fname: string }[]>`
    select p.id, p.drink_id, p.food_id, p.source_tier, (p.profile_score->>'s')::int pf, f.name fname,
      (select json_agg(e) from pairing_evidence e where e.pairing_id = p.id) ev,
      exists(select 1 from pairing_ratings r where r.drink_id = p.drink_id and r.food_id = p.food_id) rated
    from pairings p join drinks d on d.id = p.drink_id join foods f on f.id = p.food_id
    where p.status in ('curated','ai') and not d.is_demo`;
  const plan = estimateCapPlan(rows.map((r) => ({ id: r.id, d: r.drink_id, f: r.food_id, pf: r.pf ?? 0, rated: r.rated,
    estimate: evidenceStats((r.ev ?? []) as never[], r.source_tier as SrcTier).e === 0 })));
  const byFood = new Map<string, number>();
  for (const r of rows) if (plan.has(r.id)) byFood.set(r.fname, (byFood.get(r.fname) ?? 0) + 1);
  const estimates = rows.filter((r) => evidenceStats((r.ev ?? []) as never[], r.source_tier as SrcTier).e === 0).length;
  console.log(`공개 조합 ${rows.length} · 추정 ${estimates} → 숨길 추정 ${plan.size} (남는 추정 ${estimates - plan.size})`);
  console.log("많이 줄어드는 음식:", [...byFood.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} −${v}`).join(" · "));
  if (apply && plan.size) {
    const ids = [...plan] as number[];
    await sql`update pairings set status = 'hidden', updated_at = now() where id in ${sql(ids)}`;
    const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "estimate-caps");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = join(dir, `hidden-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), rule: "음식마다 맛 분석 상위 20 · 술마다 상위 5 밖의 추정 조합", undo: "update pairings set status = 'curated' where id in (...ids)", ids }, null, 1));
    await publishCatalog(sql, `추정 조합 상한 — ${ids.length}건 숨김(docs/26 §3-3)`);
    console.log(`숨김 ${ids.length}건 · 기록 ${file}`);
  }
} finally { await sql.end(); }
