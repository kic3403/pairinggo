/**
 * 같은 술이 두 번 들어갔는지 점검 — 목록을 크게 늘린 뒤(`add-candidates`) 돌린다.
 *   pnpm --filter @pairinggo/db dup-check            의심되는 쌍만 보여 준다
 *   pnpm --filter @pairinggo/db dup-check --merge    남길 쪽에 수상·구매 링크를 모으고 지울 쪽을 지운다(페어링도 함께) + 발행
 *
 * 의심 기준: 같은 양조장 + **도수가 같고**(도수가 다르면 다른 제품이다 — 범표 7%/12%, 소여강 42/50) + 이름이 같거나
 * 한쪽이 다른 쪽을 품고 남는 부분이 도수·용량 표기뿐.
 * 남길 쪽 = 수상 많은 것 → 구매 링크 있는 것 → 근거(evidence) 많은 것 → 먼저 들어온 것(낮은 번호).
 */
import { sameBrewery } from "@pairinggo/shared";
import { publishCatalog } from "./catalog-write";
import { connect } from "./sql";

const merge = process.argv.includes("--merge");
const norm = (s: string) => (s || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
/** 이름 차이가 도수·용량 표기뿐인가 */
const onlySizeDiff = (a: string, b: string) => {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (!l.includes(s)) return false;
  const rem = l.replace(s, "");
  return rem === "" || /^\d+(\.\d+)?(도|%|ml|l)?$/.test(rem);
};

const sql = connect();
try {
  type Row = { id: string; name: string; brewery_name: string | null; abv: number | null; awards: string[] | null; buy_url: string | null; buy_store: string | null; ev: number; pairs: number };
  const rows = await sql<Row[]>`
    select d.id, d.name, d.brewery_name, d.abv, d.awards, d.buy_url, d.buy_store,
           (select count(*) from pairing_evidence e join pairings p on p.id = e.pairing_id where p.drink_id = d.id)::int as ev,
           (select count(*) from pairings p where p.drink_id = d.id)::int as pairs
    from drinks d order by substring(d.id from 2)::int`;
  const num = (id: string) => Number(id.slice(1));
  const pairsFound: { keep: Row; drop: Row }[] = [];
  const dropped = new Set<string>();
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    if (dropped.has(a.id) || dropped.has(b.id)) continue;
    if (!a.brewery_name || !b.brewery_name || !sameBrewery(a.brewery_name, b.brewery_name)) continue;
    if (a.abv != null && b.abv != null && Math.abs(a.abv - b.abv) > 0.05) continue;   // 도수가 다르면 다른 제품
    const [x, y] = [norm(a.name), norm(b.name)];
    if (x.length < 2 || y.length < 2 || !onlySizeDiff(x, y)) continue;
    const score = (r: Row) => [(r.awards ?? []).length, r.buy_url ? 1 : 0, r.ev, -num(r.id)];
    const [keep, drop] = score(a) >= score(b) ? [a, b] : [b, a];   // 배열 비교는 하나씩 — 아래에서 다시 본다
    const better = (p: Row, q: Row) => { const [sp, sq] = [score(p), score(q)]; for (let k = 0; k < sp.length; k++) if (sp[k] !== sq[k]) return sp[k] > sq[k]; return true; };
    const [k2, d2] = better(a, b) ? [a, b] : [b, a];
    void keep; void drop;
    pairsFound.push({ keep: k2, drop: d2 });
    dropped.add(d2.id);
  }
  console.log(`같은 술로 보이는 쌍 ${pairsFound.length}`);
  for (const { keep, drop } of pairsFound)
    console.log(`  남김 ${keep.id} ${keep.name} (${keep.abv}%, 수상 ${(keep.awards ?? []).length}, 구매 ${keep.buy_url ? "○" : "-"}, 근거 ${keep.ev})  ←  지움 ${drop.id} ${drop.name} (${drop.abv}%, 수상 ${(drop.awards ?? []).length}, 구매 ${drop.buy_url ? "○" : "-"}, 근거 ${drop.ev}) · ${keep.brewery_name}`);

  if (merge && pairsFound.length) {
    await sql.begin(async (tx) => {
      for (const { keep, drop } of pairsFound) {
        const awards = [...new Set([...(keep.awards ?? []), ...(drop.awards ?? [])])];
        const buy = keep.buy_url ? null : drop.buy_url;
        await tx`update drinks set awards = ${tx.json(awards)},
                 buy_url = coalesce(${keep.buy_url}, ${buy}), buy_store = coalesce(${keep.buy_store}, ${drop.buy_store}), updated_at = now()
                 where id = ${keep.id}`;
        await tx`delete from pairings where drink_id = ${drop.id}`;   // pairing_evidence는 cascade
        await tx`delete from drinks where id = ${drop.id}`;
      }
    });
    await publishCatalog(sql, `중복 술 정리 -${pairsFound.length}종`);
    console.log("정리·발행 완료 — 이어서 `export`");
  } else if (!merge) console.log("\n미리보기입니다. 정리하려면 --merge");
} finally {
  await sql.end();
}
