/**
 * 카탈로그 술에 수상 이력 붙이기 — 우리술품평회 + 대한민국주류대상(우리술)
 *   pnpm --filter @pairinggo/db drink-awards           미리보기: 붙을 술·바뀌는 수상 문자열·못 붙은 수상작(같은 양조장 후보)
 *   pnpm --filter @pairinggo/db drink-awards --apply   drinks.awards 갱신 + 발행 → 이어서 `export`
 *
 * 명단: research/awards/woorisool-fair.json(농식품부 발표) · korea-liquor-awards.json(`liquor-awards-fetch`로 받음)
 * 대조 규칙은 shared `matchAwardDrink`(양조장 같음 + 이름 같음/도수·양조장 표기 차이만). 자동으로 안 붙는 것은
 * research/awards/match-overrides.json에 { "대회|제품명|업체": "d108" } (붙이지 말아야 할 것은 null)로 적는다.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drinkAwardString, matchAwardDrink, mergeDrinkAwards, sameBrewery, type AwardDrink, type DrinkAward, type DrinkCompetition } from "@pairinggo/shared";
import { publishCatalog } from "./catalog-write";
import { connect } from "./sql";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "awards");
const apply = process.argv.includes("--apply");

export type AwardEntry = DrinkAward & { name: string; brewery: string; source: string };
/** 두 대회 명단을 한 형식으로 */
export function loadAwardEntries(): AwardEntry[] {
  const out: AwardEntry[] = [];
  const fair = JSON.parse(readFileSync(join(DIR, "woorisool-fair.json"), "utf8")) as { items: { year: number; part: string; prize: string; name: string; brewery: string; source: string }[] };
  for (const x of fair.items) out.push({ competition: "우리술품평회", year: x.year, part: x.part, prize: x.prize, name: x.name, brewery: x.brewery, source: x.source });
  const klaFile = join(DIR, "korea-liquor-awards.json");
  if (existsSync(klaFile)) {
    const kla = JSON.parse(readFileSync(klaFile, "utf8")) as { items: { year: number; part: string; prize: string; name: string; brewery: string; url: string }[] };
    for (const x of kla.items) out.push({ competition: "대한민국주류대상", year: x.year, part: x.part, prize: x.prize, name: x.name, brewery: x.brewery, source: x.url });
  }
  return out;
}
export const overrideKey = (e: { competition: DrinkCompetition; name: string; brewery: string }) => `${e.competition}|${e.name}|${e.brewery}`;
export function loadOverrides(): Record<string, string | null> {
  const f = join(DIR, "match-overrides.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, string | null>) : {};
}
/** 수상작 → 카탈로그 술 id (overrides 먼저) */
export function matchEntry(e: AwardEntry, drinks: AwardDrink[], overrides: Record<string, string | null>): string | null {
  const k = overrideKey(e);
  if (k in overrides) return overrides[k];
  return matchAwardDrink(e, drinks);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sql = connect();
  try {
    type Row = { id: string; name: string; alias: string[] | null; brewery_name: string | null; abv: number | null; awards: string[] | null };
    const rows = await sql<Row[]>`select id, name, alias, brewery_name, abv, awards from drinks order by id`;
    const drinks: AwardDrink[] = rows.map((r) => ({ id: r.id, name: r.name, alias: r.alias ?? [], brewery: r.brewery_name, abv: r.abv }));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const entries = loadAwardEntries(), overrides = loadOverrides();

    const add = new Map<string, DrinkAward[]>();
    const unmatched: AwardEntry[] = [];
    for (const e of entries) {
      const id = matchEntry(e, drinks, overrides);
      if (!id || !byId.has(id)) { unmatched.push(e); continue; }
      add.set(id, [...(add.get(id) ?? []), { competition: e.competition, year: e.year, part: e.part, prize: e.prize }]);
    }

    const changes: { id: string; before: string[]; after: string[] }[] = [];
    for (const [id, list] of add) {
      const r = byId.get(id)!;
      const before = r.awards ?? [];
      const after = mergeDrinkAwards(before, list);
      if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ id, before, after });
    }

    const count = (c: DrinkCompetition) => entries.filter((e) => e.competition === c).length;
    const hit = (c: DrinkCompetition) => entries.filter((e) => e.competition === c && !unmatched.includes(e)).length;
    console.log(`명단 — 우리술품평회 ${count("우리술품평회")}건(카탈로그에 붙음 ${hit("우리술품평회")}) · 대한민국주류대상 ${count("대한민국주류대상")}건(붙음 ${hit("대한민국주류대상")})`);
    console.log(`수상 이력이 바뀌는 술 ${changes.length}종\n`);
    for (const c of changes) {
      const r = byId.get(c.id)!;
      const added = c.after.filter((s) => !c.before.includes(s)), removed = c.before.filter((s) => !c.after.includes(s));
      console.log(`  ${c.id} ${r.name} (${r.brewery_name ?? "-"})  + ${added.join(" · ")}${removed.length ? `  − ${removed.join(" · ")}` : ""}`);
    }
    // 못 붙은 수상작 중 같은 양조장 술이 카탈로그에 있는 것 — 이름 표기만 다른지 사람이 본다
    const hints = unmatched.map((e) => ({ e, same: drinks.filter((d) => d.brewery && sameBrewery(e.brewery, d.brewery)) })).filter((x) => x.same.length);
    if (hints.length) {
      console.log(`\n확인 필요 — 같은 양조장 술이 카탈로그에 있는데 붙지 않은 수상작 ${hints.length}건 (같은 술이면 match-overrides.json에)`);
      for (const { e, same } of hints) console.log(`  "${overrideKey(e)}"  ← ${drinkAwardString(e)}  · 후보: ${same.map((d) => `${d.id} ${d.name}`).join(", ")}`);
    }
    console.log(`\n카탈로그에 없는 수상작 ${unmatched.length - hints.length}건 — 라인업 후보(\`award-candidates\`)로`);

    if (apply && changes.length) {
      await sql.begin(async (tx) => {
        for (const c of changes) await tx`update drinks set awards = ${tx.json(c.after)}, updated_at = now() where id = ${c.id}`;
      });
      await publishCatalog(sql, `수상 이력 갱신 — 우리술품평회·대한민국주류대상 ${changes.length}종`);
      console.log("저장·발행 완료 — 이어서 `pnpm --filter @pairinggo/db export`");
    } else if (!apply) console.log("\n미리보기입니다. 저장하려면 --apply");
  } finally {
    await sql.end();
  }
}
