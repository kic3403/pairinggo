/**
 * 역방향 내보내기 — DB(검수 반영본) → packages/shared/data/pairings.json (git 백업·번들 폴백 갱신)
 *   pnpm --filter @pairinggo/db export
 * DB 행을 미니앱 Dataset 형식으로 되돌린다. catalog_meta.version 도 함께 출력.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA } from "@pairinggo/shared";
import { connect } from "./sql";
import { loadDatasetFromRows } from "@pairinggo/shared";

const sql = connect();
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "shared", "data", "pairings.json");
try {
  const drinks = await sql`select * from drinks order by id`;
  const foods = await sql`select * from foods order by id`;
  const pairings = await sql`select p.*, (select json_agg(e order by e.id) from pairing_evidence e where e.pairing_id = p.id) as evidence from pairings p where p.status <> 'hidden' order by p.id`;
  const [meta] = await sql<{ value: string }[]>`select value from catalog_meta where key = 'version'`;
  const ds = loadDatasetFromRows({ drinks, foods, pairings, trend_meta: DATA.trend_meta, src_meta: DATA.src_meta, profile_meta: DATA.profile_meta });
  writeFileSync(out, JSON.stringify(ds, null, 1));
  console.log(`내보내기 완료 → ${out} · drinks ${ds.drinks.length} · foods ${ds.foods.length} · pairings ${ds.pairings.length} · version ${meta?.value ?? "-"}`);
} finally {
  await sql.end();
}
