/**
 * 시드 — packages/shared/data/pairings.json → drinks · foods · pairings · pairing_evidence · catalog_meta · catalog_snapshots
 * 멱등(upsert). 실행 후 108/110/851 검증을 출력한다.
 *   pnpm --filter @pairinggo/db seed
 */
import { DATA, NON_TRAD, choseong, normalize } from "@pairinggo/shared";
import { connect } from "./sql";

const sql = connect();
const slug = (s: string) => normalize(s).replace(/[^a-z0-9가-힣]/g, "");
const version = new Date().toISOString();

try {
  await sql.begin(async (tx) => {
    for (const d of DATA.drinks) {
      const alias = [d.alias, d.brewery].filter((a): a is string => !!a && a !== d.name);
      await tx`insert into drinks (id, slug, name, alias, chosung, category, abv, region, brewery_name, description, flavor_tags, profile, awards, is_generic, online_sellable, buy_url, buy_store, offline, trend, blog_anju, updated_at)
        values (${d.id}, ${slug(d.name)}, ${d.name}, ${alias}, ${choseong(d.name.replace(/\s+/g, ""))}, ${d.category}, ${d.abv}, ${d.region || ""}, ${d.brewery || ""}, ${d.desc || ""}, ${d.flavor || []},
                ${d.profile ? tx.json(d.profile) : null}, ${tx.json(d.awards || [])}, ${!!d.generic}, ${!NON_TRAD.has(d.id)}, ${d.buy?.url ?? null}, ${d.buy?.store ?? null},
                ${d.offline ? tx.json(d.offline) : null}, ${d.trend ? tx.json(d.trend) : null}, ${d.blog_anju || 0}, now())
        on conflict (id) do update set slug = excluded.slug, name = excluded.name, alias = excluded.alias, chosung = excluded.chosung, category = excluded.category, abv = excluded.abv,
          region = excluded.region, brewery_name = excluded.brewery_name, description = excluded.description, flavor_tags = excluded.flavor_tags, profile = excluded.profile, awards = excluded.awards,
          is_generic = excluded.is_generic, online_sellable = excluded.online_sellable, buy_url = excluded.buy_url, buy_store = excluded.buy_store, offline = excluded.offline, trend = excluded.trend,
          blog_anju = excluded.blog_anju, updated_at = now()`;
    }
    for (const f of DATA.foods) {
      await tx`insert into foods (id, slug, name, alias, chosung, category, tags, profile, trend, is_new, updated_at)
        values (${f.id}, ${slug(f.name)}, ${f.name}, ${f.alias || []}, ${choseong(f.name.replace(/\s+/g, ""))}, ${f.category}, ${f.tags || []},
                ${f.profile ? tx.json(f.profile) : null}, ${f.trend ? tx.json(f.trend) : null}, ${!!f.new}, now())
        on conflict (id) do update set slug = excluded.slug, name = excluded.name, alias = excluded.alias, chosung = excluded.chosung, category = excluded.category, tags = excluded.tags,
          profile = excluded.profile, trend = excluded.trend, is_new = excluded.is_new, updated_at = now()`;
    }
    for (const p of DATA.pairings) {
      const [row] = await tx<{ id: number }[]>`insert into pairings (drink_id, food_id, expert_score, reason, blog_count, source_tier, status, profile_score, updated_at)
        values (${p.d}, ${p.f}, ${p.es}, ${p.reason || ""}, ${p.blog || 0}, ${p.src || "profile"}, 'curated', ${p.pf ? tx.json(p.pf) : null}, now())
        on conflict (drink_id, food_id) do update set expert_score = excluded.expert_score, reason = excluded.reason, blog_count = excluded.blog_count, source_tier = excluded.source_tier,
          profile_score = excluded.profile_score, updated_at = now()
        returning id`;
      // 시드 근거는 매번 재작성 (시드 출처만 — 검수자가 추가한 근거(source_id 있음)는 보존)
      await tx`delete from pairing_evidence where pairing_id = ${row.id} and source_id is null`;
      if (p.ev?.source || p.ev?.url || p.ev?.quote) {
        await tx`insert into pairing_evidence (pairing_id, source, url, quote, who, tier) values (${row.id}, ${p.ev.source ?? null}, ${p.ev.url ?? null}, ${p.ev.quote ?? null}, ${p.ev.who ?? null}, ${p.src && p.src !== "profile" ? p.src : "media"})`;
      }
    }
    const counts = { drinks: DATA.drinks.length, foods: DATA.foods.length, pairings: DATA.pairings.length };
    await tx`insert into catalog_meta (key, value, updated_at) values ('version', ${tx.json(version)}, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await tx`insert into catalog_meta (key, value, updated_at) values ('counts', ${tx.json(counts)}, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await tx`insert into catalog_snapshots (version, counts, data, note) values (${version}, ${tx.json(counts)}, ${tx.json(JSON.parse(JSON.stringify(DATA)))}, 'seed from pairings.json') on conflict (version) do nothing`;
  });

  // count(*)는 bigint → 문자열로 오므로 int로 캐스팅
  const [c] = await sql<{ d: number; f: number; p: number; e: number }[]>`select (select count(*)::int from drinks) d, (select count(*)::int from foods) f, (select count(*)::int from pairings) p, (select count(*)::int from pairing_evidence) e`;
  const under5 = await sql<{ id: string; n: number }[]>`select d.id, count(p.id)::int n from drinks d left join pairings p on p.drink_id = d.id group by d.id having count(p.id) < 5`;
  console.log(`시드 완료 — drinks ${c.d} · foods ${c.f} · pairings ${c.p} · evidence ${c.e} · version ${version}`);
  console.log(`검증: 기대 108/110/851 → ${c.d === 108 && c.f === 110 && c.p === 851 ? "OK" : "불일치!"} · 페어링 5개 미만 술: ${under5.length ? under5.map((r) => r.id).join(",") : "없음"}`);
} finally {
  await sql.end();
}
