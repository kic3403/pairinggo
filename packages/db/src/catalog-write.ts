/**
 * 새 술·페어링을 DB에 넣고 발행한다 — 라인업 확장(lineup.ts)과 양조장 라인 추가(add-drinks.ts)가 함께 쓴다.
 * 발행 순서는 어드민 발행과 같다: 스냅샷 → counts → version. 넣은 뒤 `blog-counts` → `db:export`.
 */
import { DATA, choseong, loadDatasetFromRows, normalize, type DrinkKind, type DrinkProfile, type DrinkSpec, type Fit } from "@pairinggo/shared";
import type { JSONValue, TransactionSql } from "postgres";
import { connect } from "./sql";

export const slug = (s: string) => normalize(s).replace(/[^a-z0-9가-힣]/g, "");

export type EvidenceInput = { source: string; url: string; quote: string | null; who: string | null; tier: "official" | "sommelier" | "media" | "blog" };
export type PairingInput = { f: string; es: number; src: "official" | "sommelier" | "media" | "blog" | "profile"; reason: string; pf: Fit; evidence: EvidenceInput[] };
export type DrinkInput = {
  id: string; name: string;
  /** 짧은 이름 — alias[0]은 화면·검색·언급 수집에 쓰인다(rows.ts). 없으면 제품명을 둔다(양조장 이름을 넣지 않는다) */
  alias: string | null;
  category: string; abv: number; region: string; brewery: string; desc: string; flavor: string[]; profile: DrinkProfile; awards: string[];
  buy?: { url: string; store: string } | null;
  offline?: { place: string | null; address: string; phone: string | null; visit: boolean | null; note: string } | null;
  pairings: PairingInput[];
  /** 주종 확장(0035) — 없으면 전통주·한국 */
  kind?: DrinkKind; country?: string; attrs?: Record<string, unknown>; nameOrig?: string | null;
  /** 추가 별칭(원어명·영문명) — alias 뒤에 붙는다 */
  aliases?: string[];
  /** 판매 규격·참고가격(cleanSpec으로 정리된 것) */
  specs?: DrinkSpec[];
  /** 개발 데모 — 공개 카탈로그 제외 */
  demo?: boolean;
};

/** 공개 카탈로그에 넣을 술 행인가 — 데모는 SHOW_DEMO=1일 때만(로컬 검증) */
export const includeDrinkRow = (r: { is_demo?: boolean | null }) => !r.is_demo || process.env.SHOW_DEMO === "1";
/** 규격·가격 행 읽기 — 0035 전 DB(표 없음)면 빈 배열 */
export async function loadSpecRows(sql: ReturnType<typeof connect>): Promise<{ specs: Record<string, unknown>[]; prices: Record<string, unknown>[] }> {
  try {
    const [specs, prices] = await Promise.all([sql`select * from drink_specs order by drink_id, sort, id`, sql`select * from drink_prices where valid order by id`]);
    return { specs: specs as unknown as Record<string, unknown>[], prices: prices as unknown as Record<string, unknown>[] };
  } catch { return { specs: [], prices: [] }; }
}
/** 규격·가격 넣기 — 술 한 종의 규격을 통째로 바꾼다(기존 규격 삭제 후 삽입) */
export async function replaceSpecs(tx: TransactionSql<Record<string, unknown>>, drinkId: string, specs: DrinkSpec[]) {
  await tx`delete from drink_specs where drink_id = ${drinkId}`;
  let sort = 0;
  for (const s of specs) {
    const [row] = await tx<{ id: number }[]>`insert into drink_specs (drink_id, volume_ml, abv, vintage, pack, bottles, note, sort)
      values (${drinkId}, ${s.ml}, ${s.abv ?? null}, ${s.vintage ?? null}, ${s.pack}, ${s.bottles}, ${s.note ?? null}, ${sort++}) returning id`;
    for (const p of s.prices) await tx`insert into drink_prices (spec_id, krw, price_type, source, source_url, checked_on) values (${row.id}, ${p.krw}, ${p.type}, ${p.source}, ${p.url ?? null}, ${p.checked})`;
  }
}

/** DB의 가장 큰 술 번호 — 새 id는 그다음부터 */
export async function nextDrinkNumber(): Promise<number> {
  const sql = connect();
  try {
    const [r] = await sql<{ mx: number | null }[]>`select max(substring(id from 2)::int) as mx from drinks where id ~ '^d[0-9]+$'`;
    return (r?.mx ?? 0) + 1;
  } finally { await sql.end(); }
}

/** 발행 — 어드민 발행과 같은 순서: 스냅샷 → counts → version. 웹은 최대 5분(카탈로그 캐시)+10분(ISR) 뒤 반영 */
export async function publishCatalog(sql: ReturnType<typeof connect>, note: string) {
  const [drAll, fo, paAll, sp] = await Promise.all([
    sql`select * from drinks order by id`, sql`select * from foods order by id`,
    sql`select p.*, (select json_agg(e order by e.id) from pairing_evidence e where e.pairing_id = p.id) as evidence from pairings p where p.status in ('curated','ai') order by p.id`,
    loadSpecRows(sql),
  ]);
  // 데모 술(is_demo)과 그 페어링은 공개 카탈로그·스냅샷에서 뺀다
  const dr = drAll.filter(includeDrinkRow); const ids = new Set(dr.map((r) => r.id as string));
  const pa = paAll.filter((p) => ids.has(p.drink_id as string));
  const ds = loadDatasetFromRows({ drinks: dr, foods: fo, pairings: pa, specs: sp.specs, prices: sp.prices, trend_meta: DATA.trend_meta, src_meta: DATA.src_meta, profile_meta: DATA.profile_meta });
  const version = new Date().toISOString();
  const counts = { drinks: ds.drinks.length, foods: ds.foods.length, pairings: ds.pairings.length };
  await sql`insert into catalog_snapshots (version, counts, data, note) values (${version}, ${sql.json(counts)}, ${sql.json(JSON.parse(JSON.stringify(ds)))}, ${note})`;
  await sql`insert into catalog_meta (key, value, updated_at) values ('counts', ${sql.json(counts)}, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`;
  await sql`insert into catalog_meta (key, value, updated_at) values ('version', ${sql.json(version)}, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`;
  console.log(`발행 — ${counts.drinks}종/${counts.pairings}조합 · version ${version} · ${note}`);
  return counts;
}

export async function insertDrinks(drinks: DrinkInput[], note: string) {
  const sql = connect();
  try {
    const rows = await sql<{ id: string; slug: string }[]>`select id, slug from drinks`;
    const ids = new Set(rows.map((r) => r.id)), slugs = new Set(rows.map((r) => r.slug));
    const clash = drinks.filter((d) => ids.has(d.id) || slugs.has(slug(d.name)));
    if (clash.length) throw new Error(`DB에 이미 있는 술(id 또는 이름): ${clash.map((d) => `${d.id} ${d.name}`).join(", ")}`);
    let pairs = 0, evidence = 0;
    await sql.begin(async (tx) => {
      for (const d of drinks) {
        const alias = [...new Set([d.alias ?? d.name, d.brewery, ...(d.aliases ?? []), d.nameOrig ?? ""].filter((a): a is string => !!a))];
        const kind = d.kind ?? "trad";
        await tx`insert into drinks (id, slug, name, alias, chosung, category, abv, region, brewery_name, description, flavor_tags, profile, awards, is_generic, online_sellable, buy_url, buy_store, offline, trend, blog_anju, kind, country, attrs, name_orig, is_demo, updated_at)
          values (${d.id}, ${slug(d.name)}, ${d.name}, ${alias}, ${choseong(d.name.replace(/\s+/g, ""))}, ${d.category}, ${d.abv}, ${d.region}, ${d.brewery}, ${d.desc}, ${d.flavor},
                  ${tx.json(d.profile)}, ${tx.json(d.awards)}, false, ${kind === "trad"}, ${d.buy?.url ?? null}, ${d.buy?.store ?? null}, ${d.offline ? tx.json(d.offline) : null}, null, 0,
                  ${kind}, ${d.country ?? (kind === "trad" ? "kr" : "other")}, ${tx.json((d.attrs ?? {}) as JSONValue)}, ${d.nameOrig ?? null}, ${!!d.demo}, now())`;
        if (d.specs?.length) await replaceSpecs(tx, d.id, d.specs);
        for (const p of d.pairings) {
          const [row] = await tx<{ id: number }[]>`insert into pairings (drink_id, food_id, expert_score, reason, blog_count, source_tier, status, profile_score, updated_at)
            values (${d.id}, ${p.f}, ${p.es}, ${p.reason}, 0, ${p.src}, 'curated', ${tx.json(p.pf)}, now()) returning id`;
          for (const e of p.evidence) {
            await tx`insert into pairing_evidence (pairing_id, source, url, quote, who, tier) values (${row.id}, ${e.source}, ${e.url}, ${e.quote}, ${e.who}, ${e.tier})`;
            evidence++;
          }
          pairs++;
        }
      }
    });
    const counts = await publishCatalog(sql, note);
    console.log(`DB 반영 — 술 +${drinks.length} · 페어링 +${pairs} · 근거 +${evidence} · 전체 ${counts.drinks}종/${counts.pairings}조합`);
  } finally {
    await sql.end();
  }
}
