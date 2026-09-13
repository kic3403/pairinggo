/**
 * 새 술·페어링을 DB에 넣고 발행한다 — 라인업 확장(lineup.ts)과 양조장 라인 추가(add-drinks.ts)가 함께 쓴다.
 * 발행 순서는 어드민 발행과 같다: 스냅샷 → counts → version. 넣은 뒤 `blog-counts` → `db:export`.
 */
import { DATA, choseong, loadDatasetFromRows, normalize, type DrinkProfile, type Fit } from "@pairinggo/shared";
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
};

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
  const [dr, fo, pa] = await Promise.all([
    sql`select * from drinks order by id`, sql`select * from foods order by id`,
    sql`select p.*, (select json_agg(e order by e.id) from pairing_evidence e where e.pairing_id = p.id) as evidence from pairings p where p.status in ('curated','ai') order by p.id`,
  ]);
  const ds = loadDatasetFromRows({ drinks: dr, foods: fo, pairings: pa, trend_meta: DATA.trend_meta, src_meta: DATA.src_meta, profile_meta: DATA.profile_meta });
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
        const alias = [...new Set([d.alias ?? d.name, d.brewery].filter((a): a is string => !!a))];
        await tx`insert into drinks (id, slug, name, alias, chosung, category, abv, region, brewery_name, description, flavor_tags, profile, awards, is_generic, online_sellable, buy_url, buy_store, offline, trend, blog_anju, updated_at)
          values (${d.id}, ${slug(d.name)}, ${d.name}, ${alias}, ${choseong(d.name.replace(/\s+/g, ""))}, ${d.category}, ${d.abv}, ${d.region}, ${d.brewery}, ${d.desc}, ${d.flavor},
                  ${tx.json(d.profile)}, ${tx.json(d.awards)}, false, true, ${d.buy?.url ?? null}, ${d.buy?.store ?? null}, ${d.offline ? tx.json(d.offline) : null}, null, 0, now())`;
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
