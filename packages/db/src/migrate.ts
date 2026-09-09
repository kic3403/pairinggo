/**
 * 마이그레이션 — migrations/*.sql 을 이름순으로 적용하고 schema_migrations 에 기록한다.
 *   pnpm --filter @pairinggo/db migrate            적용
 *   pnpm --filter @pairinggo/db migrate --status   상태만
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "./sql";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const statusOnly = process.argv.includes("--status");
const sql = connect();

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let n = 0;
  for (const f of files) {
    if (applied.has(f)) { console.log(`  ✓ ${f} (적용됨)`); continue; }
    if (statusOnly) { console.log(`  · ${f} (미적용)`); continue; }
    const body = readFileSync(join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${f})`;
    });
    console.log(`  + ${f} 적용`); n++;
  }
  console.log(statusOnly ? "상태 확인 완료" : `마이그레이션 완료 — 새로 적용 ${n}건`);
} finally {
  await sql.end();
}
