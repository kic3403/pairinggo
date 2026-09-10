/**
 * 파일럿 — pilot/hits.json(미리 수집한 검색 결과)에 규칙 추출을 적용해 후보 큐에 넣는다. collect.ts와 같은 extract().
 *   pnpm --filter @pairinggo/db pilot [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { D, F } from "@pairinggo/shared";
import { connect } from "./sql";
import { extract, type Hit } from "./entity";

const dry = process.argv.includes("--dry");
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "pilot", "hits.json");
const data = JSON.parse(readFileSync(file, "utf8")) as { note: string; drinks: Record<string, { query: string; hits: Hit[] }> };
const batch = `pilot@${new Date().toISOString().slice(0, 10)}`;
const sql = dry ? null : connect();
const lines: string[] = ["| 술 | 검색 결과 | 후보 | 음식 종류 | 상위 언급 (건) |", "|---|---|---|---|---|"];
let totalIns = 0, totalDup = 0;
try {
  for (const [drinkId, { query, hits }] of Object.entries(data.drinks)) {
    const cands = extract(drinkId, query, hits);
    const seen = new Set<string>(); const uniq = cands.filter((c) => { const k = c.foodId + "|" + c.url; if (seen.has(k)) return false; seen.add(k); return true; });
    const byFood = new Map<string, number>(); for (const c of uniq) byFood.set(c.foodId, (byFood.get(c.foodId) || 0) + 1);
    const top = [...byFood.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${F[id].name} ${n}`).join(" · ");
    lines.push(`| ${D[drinkId].name} | ${hits.length} | ${uniq.length} | ${byFood.size} | ${top} |`);
    if (!sql) { for (const c of uniq) console.log(`  ${F[c.foodId].name} ← [${c.kind}] ${c.sourceName} · "${c.quote.slice(0, 60)}…"`); continue; }
    let ins = 0, dup = 0;
    for (const c of uniq) {
      try {
        await sql`insert into pairing_candidates (drink_raw, food_raw, drink_id, food_id, source_name, url, quote, suggested_tier, suggested_score, origin, source_kind, query, mention_count, status, batch)
          values (${D[drinkId].name}, ${F[c.foodId].name}, ${c.drinkId}, ${c.foodId}, ${c.sourceName}, ${c.url}, ${c.quote}, ${c.tier}, ${c.tier === "media" ? 89 : 85}, 'crawl', ${c.kind}, ${c.query}, ${byFood.get(c.foodId) || 1}, 'draft', ${batch})`;
        ins++;
      } catch (e) { if ((e as { code?: string }).code === "23505") dup++; else throw e; }
    }
    totalIns += ins; totalDup += dup;
  }
  const md = lines.join("\n");
  console.log(md);
  console.log(`\n저장 ${totalIns} · 중복 ${totalDup} · 배치 ${batch}`);
  writeFileSync("pilot-report.md", `# 파일럿 수집 보고 — ${batch}\n\n${data.note}\n\n${md}\n\n저장 ${totalIns} · 중복 ${totalDup}\n`);
} finally {
  await sql?.end();
}
