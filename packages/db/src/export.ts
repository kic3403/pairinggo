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
import { includeDrinkRow, loadSpecRows } from "./catalog-write";
import { cleanDrinkItems, partnerImages, type PartnerPlaceItems } from "@pairinggo/shared";

const sql = connect();
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "shared", "data", "pairings.json");
try {
  const drinks = (await sql`select * from drinks order by id`).filter(includeDrinkRow);   // 데모 술은 번들에 넣지 않는다(0035)
  const ids = new Set(drinks.map((r) => r.id as string));
  const foods = await sql`select * from foods order by id`;
  const pairings = (await sql`select p.*, (select json_agg(e order by e.id) from pairing_evidence e where e.pairing_id = p.id) as evidence from pairings p where p.status in ('curated', 'ai') order by p.id`).filter((p) => ids.has(p.drink_id as string));   // 공개 카탈로그(apps/web/lib/catalog.ts)와 같은 기준 — pending(근거 1개, 검수 중)은 번들에도 넣지 않는다
  const [meta] = await sql<{ value: string }[]>`select value from catalog_meta where key = 'version'`;
  const sp = await loadSpecRows(sql);
  // 파트너가 올린 술 사진 폴백(웹 카탈로그와 같은 규칙, 2026-09-25)
  const pl = await sql`select m.name, m.brewery, p.drink_items from place_info p join merchants m on m.kakao_place_id = p.kakao_id where p.source = 'partner' and m.status = 'approved' and p.drink_items is not null`.catch(() => []);
  const places: PartnerPlaceItems[] = pl.map((r) => ({ name: String(r.name), brewery: (r.brewery as string | null) ?? null, items: cleanDrinkItems(r.drink_items).filter((d) => d.img) })).filter((x) => x.items.length);
  const pimg = partnerImages(drinks as { id: string; name: string; alias?: string[]; brewery?: string | null }[], places);
  for (const r of drinks) if (!r.image_url) { const p = pimg.get(String(r.id)); if (p) { r.image_url = p.url; r.image_credit = p.credit; } }
  const ds = loadDatasetFromRows({ drinks, foods, pairings, specs: sp.specs, prices: sp.prices, trend_meta: DATA.trend_meta, src_meta: DATA.src_meta, profile_meta: DATA.profile_meta });
  writeFileSync(out, JSON.stringify(ds, null, 1));
  console.log(`내보내기 완료 → ${out} · drinks ${ds.drinks.length} · foods ${ds.foods.length} · pairings ${ds.pairings.length} · version ${meta?.value ?? "-"}`);
} finally {
  await sql.end();
}
