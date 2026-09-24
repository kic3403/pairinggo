/**
 * 구매 링크가 없는 술을 전통주 전문 소매점에서 찾는다 — 2026-09-24 사용자 허용("소매점 상품 페이지 허용").
 *   pnpm --filter @pairinggo/db retail-links            찾은 상품 페이지를 research/catalog-buy-manual.json에 더한다(이미 있는 술은 건너뜀)
 *   → 이어서 `catalog-buy-links`(미리보기) → `catalog-buy-links --apply` → `export`
 *
 * 가게: 키햐(kihya.com) · 술LOVE(soollove.com) — 검색 결과 상품 목록의 제목이 술 이름의 낱말을 모두 담을 때만 그 상품 페이지를 쓴다.
 *      술마켓·ZZANN은 검색 결과를 스크립트로 그리므로 서버에서 읽을 수 없어 뺐다. 오픈마켓(11번가·G마켓·옥션)·가격비교(다나와·에누리)·데일리샷은 쓰지 않는다.
 * 상품 페이지에 그 술이 정말 보이는지는 catalog-buy-links가 다시 확인한다(사용자 규칙).
 * 검색은 술마다 가게당 한 번, 0.4초 간격 — 양이 적어 가게에 부담이 없다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NON_TRAD } from "@pairinggo/shared";
import { nameInText, squash } from "./link-check";
import { connect } from "./sql";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANUAL = join(ROOT, "research", "catalog-buy-manual.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Shop = { name: string; search: (q: string) => string; item: RegExp; product: (m: RegExpMatchArray, base: string) => string };
const SHOPS: Shop[] = [
  {
    name: "키햐",
    search: (q) => `https://m.kihya.com/goods/goods_search.php?keyword=${encodeURIComponent(q)}`,
    item: /href="([^"]*goods_view\.php\?goodsNo=(\d+))"[^>]*>[\s\S]{0,600}?alt="([^"]{2,120})"/g,
    product: (m) => `https://m.kihya.com/goods/goods_view.php?goodsNo=${m[2]}`,
  },
  {
    name: "술LOVE",
    search: (q) => `https://soollove.com/product/search.html?keyword=${encodeURIComponent(q)}`,
    item: /href="(\/product\/detail\.html\?product_no=(\d+)[^"]*)"[^>]*>[\s\S]{0,600}?alt="([^"]{2,160})"/g,
    product: (m) => `https://soollove.com/product/detail.html?product_no=${m[2]}`,
  },
];

async function fetchText(url: string): Promise<string> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (pairinggo link check)" }, signal: ctl.signal });
    return r.ok ? await r.text() : "";
  } catch { return ""; } finally { clearTimeout(t); }
}

const DRINK_WORD = /막걸리|탁주|약주|청주|소주|증류|와인|리큐르|과실주|전통주|\d+\s*도\b|\d+\s*ml/i;
/** 검색 결과에서 이 술의 상품 페이지 — 제목에 술 이름(또는 별칭)의 낱말이 모두 있고, 품절이 아닌 것을 먼저 */
async function findInShop(shop: Shop, names: string[], brewery: string | null): Promise<{ url: string; title: string } | null> {
  const html = await fetchText(shop.search(names[0]));
  if (!html) return null;
  const hits: { url: string; title: string; soldout: boolean }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(shop.item)) {
    const url = shop.product(m, ""), title = m[3].replace(/&amp;/g, "&");
    if (seen.has(url)) continue; seen.add(url);
    if (!names.some((n) => nameInText(n, squash(title)))) continue;
    // 술이 아닌 물건이 이름만 겹치는 경우를 거른다 — "파랑"이 보자기 상품에 걸렸다(2026-09-24). 제목에 술 낱말이나 양조장 이름이 있어야 한다
    if (!DRINK_WORD.test(title) && !(brewery && nameInText(brewery, squash(title)))) continue;
    hits.push({ url, title, soldout: /품절|일시품절|sold ?out/i.test(m[0]) });
  }
  return hits.find((h) => !h.soldout) ?? hits[0] ?? null;
}

const sql = connect();
try {
  type Row = { id: string; name: string; alias: string[] | null; brewery_name: string | null; buy_url: string | null };
  const rows = await sql<Row[]>`select id, name, alias, brewery_name, buy_url from drinks order by substring(id from 2)::int`;
  const manual: Record<string, unknown> = existsSync(MANUAL) ? JSON.parse(readFileSync(MANUAL, "utf8")) : {};
  const empty = rows.filter((r) => !r.buy_url && !NON_TRAD.has(r.id) && !manual[r.id]);
  console.log(`구매 링크 없는 술 ${empty.length}종(수동 표에 이미 있는 것 제외) — 키햐·술LOVE에서 찾는다`);
  let added = 0;
  for (const r of empty) {
    const names = [r.name, ...(r.alias ?? []).filter((a) => a && a !== r.name)];
    let got: { shop: string; url: string; title: string } | null = null;
    for (const shop of SHOPS) {
      const hit = await findInShop(shop, names, r.brewery_name);
      await sleep(400);
      if (hit) { got = { shop: shop.name, ...hit }; break; }
    }
    if (!got) { console.log(`  · ${r.id} ${r.name} — 없음`); continue; }
    manual[r.id] = { url: got.url, kind: "소매점", store: got.shop, from: `소매점 검색 — ${got.shop} "${got.title}"` };
    added++;
    console.log(`  ✓ ${r.id} ${r.name} → ${got.shop} ${got.url}  (${got.title})`);
  }
  writeFileSync(MANUAL, JSON.stringify(manual, null, 1) + "\n");
  console.log(`소매점 상품 페이지 ${added}건을 ${MANUAL}에 더했다 — 이어서 catalog-buy-links`);
} finally {
  await sql.end();
}
