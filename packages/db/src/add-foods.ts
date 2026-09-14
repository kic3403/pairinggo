/**
 * 음식 추가 — 사람이 정한 음식 목록(JSON: 이름·분류·태그·별칭·맛 프로필 + 근거 조합)으로 새 음식과 페어링을 넣는다(2026-09-14).
 *   pnpm --filter @pairinggo/db add-foods research/additions/<파일>.json            미리보기(DB 안 건드림)
 *   pnpm --filter @pairinggo/db add-foods research/additions/<파일>.json --apply    DB 추가 + 발행
 * 이어서 `blog-counts` → `pf-recalc` → `db:export`.
 *
 * - 근거 조합(evidence): 출처 URL 필수, 인용문은 120자 이내(없으면 null). 술 이름은 카탈로그 이름 그대로.
 * - 음식당 TOTAL개 중 나머지는 맛 분석(planDrinksForFood — 맛 프로필 궁합 + 같은 음식 분류 전문가 조합의 술 종류 + 인기)으로 채운다.
 * - recategorize: 기존 음식의 분류를 옮긴다(예: 월남쌈 양식 → 아시아).
 * - 이름·별칭이 기존 음식 이름·별칭과 겹치면 멈춘다(검색·언급 수집이 엉킨다).
 */
import { readFileSync } from "node:fs";
import { DATA, choseong, drinkCategoryAffinity, planDrinksForFood, profileFit, type FoodProfile } from "@pairinggo/shared";
import { publishCatalog, slug, type EvidenceInput } from "./catalog-write";
import { connect } from "./sql";

type Spec = {
  recategorize?: Record<string, string>;
  foods: { name: string; category: string; tags: string[]; alias: string[]; profile: FoodProfile;
    evidence?: { drink: string; es: number; src: "official" | "sommelier" | "media" | "blog"; reason: string; items: EvidenceInput[] }[] }[];
};

const file = process.argv[2];
if (!file) { console.error("사용: add-foods <json> [--apply]"); process.exit(2); }
const apply = process.argv.includes("--apply");
const spec = JSON.parse(readFileSync(file, "utf8")) as Spec;
const TOTAL = 10;

const taken = new Map<string, string>();
for (const f of DATA.foods) for (const n of [f.name, ...(f.alias || [])]) taken.set(slug(n), f.name);
const drinkByName = new Map(DATA.drinks.map((d) => [d.name, d]));
const drinks = DATA.drinks.map((d) => ({ id: d.id, name: d.name, category: d.category, abv: d.abv ?? null, profile: d.profile, trend: d.trend }));
const maxNum = Math.max(...DATA.foods.map((f) => Number(f.id.slice(1)) || 0));

type Row = { id: string; name: string; category: string; tags: string[]; alias: string[]; profile: FoodProfile; pairings: { d: string; es: number; src: string; reason: string; pf: ReturnType<typeof profileFit>; evidence: EvidenceInput[] }[] };
const usage = new Map<string, number>();
const out: Row[] = [];
let n = maxNum + 1;
for (const f of spec.foods) {
  for (const nm of [f.name, ...f.alias]) {
    const clash = taken.get(slug(nm));
    if (clash) throw new Error(`'${nm}'은 이미 '${clash}'의 이름·별칭입니다`);
  }
  for (const nm of [f.name, ...f.alias]) taken.set(slug(nm), f.name);
  const pairings: Row["pairings"] = [];
  for (const e of f.evidence ?? []) {
    const d = drinkByName.get(e.drink);
    if (!d?.profile) throw new Error(`${f.name}: 카탈로그에 없는 술 '${e.drink}'`);
    for (const it of e.items) {
      if (!it.url) throw new Error(`${f.name} × ${e.drink}: 근거 URL 없음`);
      if (it.quote && it.quote.length > 120) throw new Error(`${f.name} × ${e.drink}: 인용문 120자 초과`);
    }
    pairings.push({ d: d.id, es: e.es, src: e.src, reason: e.reason, pf: profileFit(d.profile, d.abv ?? null, f.profile), evidence: e.items });
  }
  const aff = drinkCategoryAffinity(DATA.pairings, DATA.drinks, DATA.foods, f.category);
  const planned = planDrinksForFood({ category: f.category, profile: f.profile }, drinks.filter((d) => !pairings.some((p) => p.d === d.id)), { total: TOTAL - pairings.length, perCategory: 3 }, usage, aff);
  for (const p of planned) pairings.push({ ...p, evidence: [] });
  out.push({ id: `f${n++}`, name: f.name, category: f.category, tags: f.tags, alias: f.alias, profile: f.profile, pairings });
}

const DN = new Map(DATA.drinks.map((d) => [d.id, `${d.name}(${d.category})`]));
for (const f of out) {
  console.log(`${f.id} ${f.name} [${f.category}] ${JSON.stringify(f.profile)}`);
  console.log(`   ${f.pairings.map((p) => `${p.src === "profile" ? "" : `[${p.src}]`}${DN.get(p.d)}`).join(", ")}`);
}
const used = [...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, c]) => `${DN.get(id)} ${c}`);
console.log(`\n음식 +${out.length} · 페어링 +${out.reduce((a, f) => a + f.pairings.length, 0)} · 많이 쓰인 술: ${used.join(", ")}`);
for (const [name, cat] of Object.entries(spec.recategorize ?? {})) console.log(`분류 변경: ${name} → ${cat}`);

if (!apply) { console.log("미리보기입니다. 넣으려면 --apply"); process.exit(0); }

const sql = connect();
try {
  const rows = await sql<{ id: string; slug: string }[]>`select id, slug from foods`;
  const ids = new Set(rows.map((r) => r.id)), slugs = new Set(rows.map((r) => r.slug));
  const clash = out.filter((f) => ids.has(f.id) || slugs.has(slug(f.name)));
  if (clash.length) throw new Error(`DB에 이미 있는 음식(id 또는 이름): ${clash.map((f) => `${f.id} ${f.name}`).join(", ")}`);
  let pairs = 0, evidence = 0;
  await sql.begin(async (tx) => {
    for (const [name, cat] of Object.entries(spec.recategorize ?? {})) {
      const r = await tx`update foods set category = ${cat}, updated_at = now() where name = ${name}`;
      if (r.count !== 1) throw new Error(`분류 변경 대상 없음: ${name}`);
    }
    for (const f of out) {
      await tx`insert into foods (id, slug, name, alias, chosung, category, tags, profile, is_new, updated_at)
        values (${f.id}, ${slug(f.name)}, ${f.name}, ${f.alias}, ${choseong(f.name.replace(/\s+/g, ""))}, ${f.category}, ${f.tags}, ${tx.json(f.profile)}, true, now())`;
      for (const p of f.pairings) {
        const [row] = await tx<{ id: number }[]>`insert into pairings (drink_id, food_id, expert_score, reason, blog_count, source_tier, status, profile_score, updated_at)
          values (${p.d}, ${f.id}, ${p.es}, ${p.reason}, 0, ${p.src}, 'curated', ${tx.json(p.pf)}, now()) returning id`;
        for (const e of p.evidence) {
          await tx`insert into pairing_evidence (pairing_id, source, url, quote, who, tier) values (${row.id}, ${e.source}, ${e.url}, ${e.quote}, ${e.who}, ${e.tier})`;
          evidence++;
        }
        pairs++;
      }
    }
  });
  const counts = await publishCatalog(sql, `음식 확장 +${out.length}종(양식·중식·일식·아시아)`);
  console.log(`DB 반영 — 음식 +${out.length} · 페어링 +${pairs} · 근거 +${evidence} · 전체 음식 ${counts.drinks ? "" : ""}${(await sql`select count(*)::int n from foods`)[0].n}종/${counts.pairings}조합`);
} finally {
  await sql.end();
}
