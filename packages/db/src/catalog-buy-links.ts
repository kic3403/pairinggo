/**
 * 카탈로그 술의 빈 구매 링크 채우기 — 업체가 공개해 둔 링크만 쓴다(스마트스토어 페이지는 열지 않는다, modoo.at 제외).
 *   pnpm --filter @pairinggo/db catalog-buy-links            미리보기
 *   pnpm --filter @pairinggo/db catalog-buy-links --apply    drinks.buy_url/buy_store 채우고 발행 → 이어서 `export`
 *
 * 출처 순서: ① 더술닷컴 제품 정보의 홈페이지(양조장 등록) ② 요즘이술 제품 상세의 "구매하러 가기"(수상작만 있음, buy-links 캐시)
 *           ③ 같은 양조장 다른 술에 이미 붙어 있는 링크. 온라인 판매 불가 술(NON_TRAD)은 건드리지 않는다.
 * 링크는 첫 화면이 열리는지 확인한다(옛 사이트는 https가 막히고 http만 되는 곳이 많아 둘 다 본다).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NON_TRAD, matchAwardDrink, sameBrewery, type AwardDrink } from "@pairinggo/shared";
import { cleanShopUrl } from "./buy-links";
import { publishCatalog } from "./catalog-write";
import { loadResearch } from "./research";
import { connect } from "./sql";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function alive(url: string): Promise<string | null> {
  const try1 = url.replace(/^http:/, "https:"), try2 = url.replace(/^https:/, "http:");
  for (const u of [try1, try2]) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(u, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (pairinggo link check)" } });
      clearTimeout(t);
      if (r.status < 400 || r.status === 403 || r.status === 405) return u;
    } catch { /* 다음 주소 */ }
  }
  return null;
}

const sql = connect();
try {
  type Row = { id: string; name: string; alias: string[] | null; brewery_name: string | null; abv: number | null; buy_url: string | null; buy_store: string | null };
  const rows = await sql<Row[]>`select id, name, alias, brewery_name, abv, buy_url, buy_store from drinks order by substring(id from 2)::int`;
  const empty = rows.filter((r) => !r.buy_url && !NON_TRAD.has(r.id));
  console.log(`전체 ${rows.length}종 · 구매 링크 없음 ${empty.length}종(온라인 판매 불가 ${rows.filter((r) => NON_TRAD.has(r.id)).length}종 제외)`);

  // ① 더술닷컴 제품 정보의 홈페이지
  const research = loadResearch();
  const products: (AwardDrink & { homepage: string })[] = research.map((p) => ({ id: p.id, name: p.name, alias: [], brewery: p.brewery, abv: p.abv, homepage: p.homepage }));
  const byProduct = new Map(products.map((p) => [p.id, p]));
  // ② buy-links가 받아 둔 요즘이술 링크 (제품 상세 캐시)
  const yosool: Record<string, { buy: string | null; home: string | null }> = existsSync(join(ROOT, "research", "awards", "yosool-links.json"))
    ? JSON.parse(readFileSync(join(ROOT, "research", "awards", "yosool-links.json"), "utf8")) : {};
  const kla: { name: string; brewery: string; abv: number | null; url: string }[] = existsSync(join(ROOT, "research", "awards", "korea-liquor-awards.json"))
    ? JSON.parse(readFileSync(join(ROOT, "research", "awards", "korea-liquor-awards.json"), "utf8")).items : [];

  const found: { row: Row; url: string; store: string; from: string }[] = [];
  const checked = new Map<string, string | null>();
  for (const r of empty) {
    const d = { name: r.name, brewery: r.brewery_name, abv: r.abv };
    const cands: { url: string; kind: string; from: string }[] = [];
    const pid = matchAwardDrink(d, products);
    const hp = pid ? cleanShopUrl(byProduct.get(pid)?.homepage ?? "") : null;
    if (hp) cands.push({ ...hp, from: "더술닷컴 홈페이지(양조장 등록)" });
    const k = kla.find((x) => matchAwardDrink(d, [{ id: "x", name: x.name, alias: [], brewery: x.brewery, abv: x.abv }]) === "x");
    const seq = k?.url.match(/seq=(\d+)/)?.[1];
    if (seq && yosool[seq]) {
      const b = cleanShopUrl(yosool[seq].buy ?? ""), h = cleanShopUrl(yosool[seq].home ?? "");
      if (b) cands.push({ ...b, from: "요즘이술 구매하러 가기(업체 등록)" });
      if (h) cands.push({ ...h, from: "요즘이술 홈페이지(업체 등록)" });
    }
    const best = cands.sort((a, b) => Number(b.kind === "스마트스토어") - Number(a.kind === "스마트스토어"))[0];
    if (!best) continue;
    if (best.kind !== "스마트스토어") {
      if (!checked.has(best.url)) { checked.set(best.url, await alive(best.url)); await sleep(150); }
      const ok = checked.get(best.url);
      if (!ok) continue;
      best.url = ok;
    }
    found.push({ row: r, url: best.url, store: best.kind === "스마트스토어" ? "양조장 공식 스마트스토어" : "양조장 공식몰", from: best.from });
  }

  // ③ 같은 양조장 다른 술의 링크 (원래 있던 것 + 이번에 찾은 것)
  const byBrewery = new Map<string, { url: string; store: string }>();
  for (const r of rows) if (r.buy_url && r.brewery_name) byBrewery.set(r.brewery_name, { url: r.buy_url, store: r.buy_store ?? "양조장 공식몰" });
  for (const f of found) if (f.row.brewery_name) byBrewery.set(f.row.brewery_name, { url: f.url, store: f.store });
  const foundIds = new Set(found.map((f) => f.row.id));
  for (const r of empty) {
    if (foundIds.has(r.id) || !r.brewery_name) continue;
    for (const [b, link] of byBrewery) if (sameBrewery(b, r.brewery_name)) { found.push({ row: r, ...link, from: `같은 양조장(${b})의 링크` }); break; }
  }

  console.log(`채울 수 있는 술 ${found.length}종 — 더술닷컴 ${found.filter((f) => f.from.startsWith("더술닷컴")).length} · 요즘이술 ${found.filter((f) => f.from.startsWith("요즘이술")).length} · 같은 양조장 ${found.filter((f) => f.from.startsWith("같은")).length}`);
  for (const f of found.slice(0, 20)) console.log(`  ${f.row.id} ${f.row.name} (${f.row.brewery_name}) → ${f.url}  [${f.from}]`);
  if (found.length > 20) console.log(`  … 그 밖 ${found.length - 20}종`);
  console.log(`여전히 빈칸 ${empty.length - found.length}종 — 화면은 네이버쇼핑 검색으로 연결됩니다`);

  if (apply && found.length) {
    await sql.begin(async (tx) => {
      for (const f of found) await tx`update drinks set buy_url = ${f.url}, buy_store = ${f.store}, updated_at = now() where id = ${f.row.id}`;
    });
    await publishCatalog(sql, `구매 링크 채우기 +${found.length}종`);
    console.log("저장·발행 완료 — 이어서 `export`");
  } else if (!apply) console.log("\n미리보기입니다. 저장하려면 --apply");
} finally {
  await sql.end();
}
