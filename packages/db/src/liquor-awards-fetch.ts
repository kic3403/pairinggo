/**
 * 대한민국주류대상(조선비즈 주최) 우리술 수상작 받기 — 요즘이술(yosool.co.kr) "주류대상 수상작 보기"의 우리술 탭
 *   pnpm --filter @pairinggo/db liquor-awards-fetch            최근 5개 연도 → research/awards/korea-liquor-awards.json
 *   pnpm --filter @pairinggo/db liquor-awards-fetch 2026 2025  고른 연도만 (나머지 연도 행은 파일에 그대로)
 *
 * 가져오는 것은 수상 사실(연도·등급·세부 주종)과 제품 기본 정보(제품명·업체·도수·용량·원료·제조 지역)뿐이다.
 * 소개글·테이스팅 노트·심사평은 저작권이 있는 글이라 받지 않는다. robots.txt는 /publ/만 막는다.
 * 목록은 21개씩 나눠 오고(getAwardAlcoholList.do), 세부 주종은 제품 상세에만 있다 — 요청 사이 0.4초 쉰다.
 * 그해 Best of Best(주종별 최고점)에 오른 우리술은 우리술 탭에서 빠지고 Best of Best 탭에만 있어 두 탭을 합친다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.yosool.co.kr";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "awards", "korea-liquor-awards.json");
/** 요즘이술 연도 탭 번호(seqAward) — 사이트 "주류대상 수상작 보기" 탭에서 확인(2026-09-20). 새해 결과가 나오면 여기에 한 줄 */
const SEQ_AWARD: Record<number, number> = { 2026: 17, 2025: 16, 2024: 15, 2023: 2, 2022: 12, 2021: 3, 2020: 4 };
const WOORISOOL = 24;   // 우리술 탭(seqCategory1)
const YEARS = 5;

export type LiquorAward = {
  year: number; prize: "Best of Best" | "대상"; part: string; name: string; brewery: string;
  abv: number | null; volume: string; materials: string; sido: string; sigungu: string; seq: number; url: string;
};
export type LiquorAwardFile = { meta: { competition: "대한민국주류대상"; host: string; source: string; fetched: string; years: number[] }; items: LiquorAward[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (pairinggo research; +https://pairinggo.vercel.app)" };
const text = (s: string) => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

async function post(path: string, body: Record<string, string | number>, form = false) {
  const init: RequestInit = { method: "POST", headers: { ...UA } };
  if (form) { const fd = new FormData(); for (const [k, v] of Object.entries(body)) fd.append(k, String(v)); init.body = fd; }
  else { init.body = new URLSearchParams(Object.entries(body).map(([k, v]): [string, string] => [k, String(v)])); (init.headers as Record<string, string>)["Content-Type"] = "application/x-www-form-urlencoded"; }
  for (let i = 0; i < 3; i++) {
    const r = await fetch(BASE + path, init);
    if (r.ok) return r.text();
    await sleep(1500 * (i + 1));
  }
  throw new Error(`요청 실패 ${path} ${JSON.stringify(body)}`);
}

type ListRow = { seq: number; name: string; brewery: string; ctg: string };
/** 연도 탭 목록 — category 24 = 우리술, 0 = Best of Best(모든 주종의 주종별 최고점. 여기 오른 술은 주종 탭에서 빠진다) */
async function listYear(year: number, category = WOORISOOL): Promise<ListRow[]> {
  const seqAward = SEQ_AWARD[year];
  if (!seqAward) throw new Error(`${year}년 탭 번호를 모릅니다 — SEQ_AWARD에 추가`);
  const html = await post("/alcohol/award.do", { seqAward, seqCategory1: category });
  const total = Number(html.match(/var totalCount = "(\d+)"/)?.[1] ?? 0);
  const rows: ListRow[] = [];
  const re = /submitPage\('\/search\/alcohol\.do', 'seq:(\d+)'\)[\s\S]*?class="ctg">([\s\S]*?)<\/span>[\s\S]*?class="company">([\s\S]*?)<\/span>[\s\S]*?class="tit">([\s\S]*?)<\/strong>/g;
  for (const m of html.matchAll(re)) rows.push({ seq: Number(m[1]), ctg: text(m[2]), brewery: text(m[3]), name: text(m[4]) });
  for (let page = 2; rows.length < total && page < 30; page++) {
    await sleep(400);
    const j = JSON.parse(await post("/alcohol/getAwardAlcoholList.do", { currentPage: page, totalCount: total, seqAward, seqCategory1: category }, true)) as { result?: { seq: number; korName: string; companyName: string; categoryName1: string }[] };
    if (!j.result?.length) break;
    for (const r of j.result) rows.push({ seq: r.seq, name: text(r.korName), brewery: text(r.companyName), ctg: text(r.categoryName1) });
  }
  const uniq = [...new Map(rows.map((r) => [r.seq, r])).values()];
  if (uniq.length !== total) console.warn(`  ${year}(${category}): 목록 ${uniq.length}건 / 사이트 표시 ${total}건`);
  return uniq;
}

type Detail = { part: string; awards: { year: number; prize: LiquorAward["prize"] }[]; abv: number | null; volume: string; materials: string; sido: string; sigungu: string };
const cell = (html: string, th: RegExp) => { const m = html.match(new RegExp(`<th>\\s*${th.source}[\\s\\S]*?</th>\\s*<td>([\\s\\S]*?)</td>`)); return m ? text(m[1]) : ""; };
async function detail(seq: number): Promise<Detail> {
  const html = await post("/search/alcohol.do", { seq });
  const ctg = html.match(/<div class="ctg">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const part = text(ctg.replace(/<span class="arw"><\/span>/, "|")).split("|")[1]?.trim() || "";
  const dl = html.match(/<dl class="award">[\s\S]*?<dt>\s*대한민국주류대상\s*<\/dt>([\s\S]*?)<\/dl>/)?.[1] ?? "";
  const awards = [...dl.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])).map((t) => {
    const y = Number(t.match(/^(20\d\d)/)?.[1]);
    return y ? { year: y, prize: /best\s*of\s*best/i.test(t) ? "Best of Best" as const : "대상" as const } : null;
  }).filter((x): x is { year: number; prize: LiquorAward["prize"] } => !!x);
  const vol = cell(html, /용량/).split("/")[0].trim();
  const region = cell(html, /제조지역/).split(" ").filter(Boolean);
  const abvRaw = cell(html, /알콜도수/).match(/(\d+(?:\.\d+)?)/)?.[1];
  return { part, awards, abv: abvRaw ? Number(abvRaw) : null, volume: vol, materials: cell(html, /원료/), sido: region[0] ?? "", sigungu: region.slice(1).join(" ") };
}

const years = process.argv.slice(2).map(Number).filter((y) => y > 2000);
const want = years.length ? years : Object.keys(SEQ_AWARD).map(Number).sort((a, b) => b - a).slice(0, YEARS);
const prev: LiquorAwardFile | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const items: LiquorAward[] = (prev?.items ?? []).filter((x) => !want.includes(x.year));
const details = new Map<number, Detail>();

for (const year of want) {
  const winners = await listYear(year);
  await sleep(400);
  const best = (await listYear(year, 0)).filter((r) => r.ctg === "우리술");
  const bestSeq = new Set(best.map((r) => r.seq));
  const rows = [...best, ...winners.filter((r) => !bestSeq.has(r.seq))];
  console.log(`${year}: 우리술 대상 ${winners.length}건 + Best of Best ${best.length}건 — 상세 읽는 중`);
  for (const r of rows) {
    if (!details.has(r.seq)) { await sleep(400); details.set(r.seq, await detail(r.seq)); }
    const d = details.get(r.seq)!;
    const aw = d.awards.find((a) => a.year === year);
    items.push({ year, prize: bestSeq.has(r.seq) ? "Best of Best" : aw?.prize ?? "대상", part: d.part, name: r.name, brewery: r.brewery, abv: d.abv, volume: d.volume, materials: d.materials, sido: d.sido, sigungu: d.sigungu, seq: r.seq, url: `${BASE}/search/alcohol.do?seq=${r.seq}` });
  }
}
items.sort((a, b) => b.year - a.year || Number(b.prize === "Best of Best") - Number(a.prize === "Best of Best") || a.name.localeCompare(b.name, "ko"));
const allYears = [...new Set(items.map((x) => x.year))].sort((a, b) => b - a);
mkdirSync(dirname(OUT), { recursive: true });
const file: LiquorAwardFile = { meta: { competition: "대한민국주류대상", host: "조선비즈", source: `${BASE}/alcohol/award.do (우리술 탭)`, fetched: new Date().toISOString().slice(0, 10), years: allYears }, items };
writeFileSync(OUT, JSON.stringify(file, null, 1) + "\n");
const by = (k: (x: LiquorAward) => string) => items.reduce((m, x) => { m[k(x)] = (m[k(x)] || 0) + 1; return m; }, {} as Record<string, number>);
console.log(`저장 ${OUT}\n연도`, by((x) => String(x.year)), "\n등급", by((x) => x.prize), "\n주종", by((x) => x.part || "(없음)"));
