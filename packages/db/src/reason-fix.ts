/**
 * 어색한 자동 문장 고치기(2026-10-02) — pairings.reason의 틀 문장("○○와(과) 함께 즐긴 후기·추천이 있는 조합 — 블로그 근거")을
 * 조사를 맞춘 문장으로 바꾼다. 규칙은 shared pairing/reason-fix.ts(틀 문장이 아니면 손대지 않음).
 *   pnpm --filter @pairinggo/db reason-fix            무엇이 어떻게 바뀌는지만 보여 준다
 *   pnpm --filter @pairinggo/db reason-fix --apply    바꾸고 발행(되돌리기용 목록을 research/reason-fix/에 남긴다) → 이어서 db:export
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fixTemplateReason } from "@pairinggo/shared";
import { publishCatalog } from "./catalog-write";
import { connect } from "./sql";

const apply = process.argv.includes("--apply");
const sql = connect();
try {
  const rows = await sql<{ id: string; drink_id: string; food_id: string; reason: string | null; status: string }[]>`select id, drink_id, food_id, reason, status from pairings where reason like '%(과)%' or reason like '%(와)%'`;
  const plan = rows.map((r) => ({ ...r, next: fixTemplateReason(r.reason) })).filter((r): r is typeof r & { next: string } => !!r.next);
  console.log(`괄호 조사가 든 문장 ${rows.length}건 · 틀 문장으로 고칠 것 ${plan.length}건 · 손대지 않는 것 ${rows.length - plan.length}건`);
  for (const r of plan.slice(0, 6)) console.log(`  ${r.drink_id}×${r.food_id}  ${r.reason}\n      → ${r.next}`);
  for (const r of rows.filter((x) => !fixTemplateReason(x.reason)).slice(0, 5)) console.log(`  (그대로) ${r.drink_id}×${r.food_id}  ${r.reason}`);
  if (!apply) { console.log("\n미리보기입니다 — 바꾸려면 --apply"); }
  else if (plan.length) {
    mkdirSync("research/reason-fix", { recursive: true });
    const file = `research/reason-fix/${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(file, JSON.stringify(plan.map(({ id, drink_id, food_id, reason, next }) => ({ id, drink_id, food_id, before: reason, after: next })), null, 1));
    await sql.begin(async (tx) => { for (const r of plan) await tx`update pairings set reason = ${r.next} where id = ${r.id} and reason = ${r.reason}`; });
    await publishCatalog(sql, `어색한 자동 문장 ${plan.length}건 고침(reason-fix)`);
    console.log(`\n${plan.length}건 바꾸고 발행했습니다 · 되돌리기 목록 ${file} · 이어서 pnpm db:export`);
  }
} finally { await sql.end(); }
