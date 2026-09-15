/**
 * 자동 수집 — 네이버 검색 API(블로그·카페·뉴스) + 유튜브 Data API 로 "{술} 안주/페어링/어울리는" 을 검색해
 * 제목·요약에서 카탈로그 음식 이름을 찾아 pairing_candidates(origin: crawl)에 넣는다. AI 없이 규칙 기반.
 *   pnpm db:collect [--drink d01,d02 | --top 10 | --all]  ·  음식 기준: --food f121,f129 | --gap-foods [--naver-blog --naver-cafe --naver-news --youtube] [--dry]
 * 키: NCP_API_KEY_ID / NCP_API_KEY (네이버 API HUB) · YOUTUBE_API_KEY (packages/db/.env). 없으면 해당 소스는 건너뛴다.
 *     (구 개발자센터 키 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 도 2027-06-30까지는 동작)
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { DATA, POPULAR, F, D, evidenceGaps } from "@pairinggo/shared";
import { connect } from "./sql";
import { extract, extractForFood, stripHtml, type Hit, type Candidate } from "./entity";

type Kind = Hit["kind"];

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (k: string) => args.includes(`--${k}`);
const dry = flag("dry");
const kinds: Kind[] = (["blog", "cafe", "news", "youtube"] as Kind[]).filter((k) => flag(k === "youtube" ? "youtube" : `naver-${k}`));
const useKinds: Kind[] = kinds.length ? kinds : ["blog", "cafe", "news", "youtube"];

// 음식 기준 수집(docs/20 P2-2): --food f121,f129 | --gap-foods(근거 없는 음식 전부) — "{음식} 전통주/막걸리/술 페어링"을 검색해 본문의 카탈로그 술 이름을 찾는다
const foodMode = !!opt("food") || flag("gap-foods");
const foods = opt("food") ? DATA.foods.filter((f) => opt("food")!.split(",").includes(f.id))
  : flag("gap-foods") ? (() => { const g = evidenceGaps(DATA); return DATA.foods.filter((f) => g.foods.has(f.id)); })() : [];
const drinks = foodMode ? [] : opt("drink") ? DATA.drinks.filter((d) => opt("drink")!.split(",").includes(d.id))
  : flag("all") ? DATA.drinks : POPULAR.slice(0, parseInt(opt("top") || "10"));

// 네이버 검색: 2026-07부터 개발자센터(openapi.naver.com) 신규 신청 중단 → 네이버클라우드 NAVER API HUB(naverapihub.apigw.ntruss.com).
// 새 키는 NCP_API_KEY_ID / NCP_API_KEY (콘솔 Application 인증 정보). 예전 개발자센터 키(NAVER_CLIENT_ID/SECRET)는 2027-06-30까지만 동작.
const HUB_ID = process.env.NCP_API_KEY_ID, HUB_KEY = process.env.NCP_API_KEY;
const NID = process.env.NAVER_CLIENT_ID, NSEC = process.env.NAVER_CLIENT_SECRET, YT = process.env.YOUTUBE_API_KEY;
const hasNaver = !!((HUB_ID && HUB_KEY) || (NID && NSEC));
if (!hasNaver && !YT) { console.error("[collect] NCP_API_KEY_ID/NCP_API_KEY(네이버 API HUB) 또는 YOUTUBE_API_KEY 가 필요합니다 (packages/db/.env). docs/11 참고."); process.exit(2); }
if (hasNaver) console.log(`[collect] 네이버 검색: ${HUB_ID && HUB_KEY ? "NAVER API HUB" : "개발자센터(구 방식, 2027-06까지)"}`);

// 네트워크 오류(ECONNRESET 등)는 최대 3회 재시도 — 한 번의 끊김으로 전체 수집이 죽지 않게
async function fetchRetry(url: string, init?: RequestInit, tries = 3): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try { return await fetch(url, init); } catch (e) { console.warn(`[fetch] ${(e as Error).message} (${i + 1}/${tries}) ${url.slice(0, 60)}…`); await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return null;
}
async function naver(kind: "blog" | "cafearticle" | "news", query: string, display = 50): Promise<Hit[]> {
  if (!hasNaver) return [];
  const q = `query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
  const res = HUB_ID && HUB_KEY
    ? await fetchRetry(`https://naverapihub.apigw.ntruss.com/search/v1/${kind}?${q}`, { headers: { "X-NCP-APIGW-API-KEY-ID": HUB_ID, "X-NCP-APIGW-API-KEY": HUB_KEY } })
    : await fetchRetry(`https://openapi.naver.com/v1/search/${kind}.json?${q}`, { headers: { "X-Naver-Client-Id": NID!, "X-Naver-Client-Secret": NSEC! } });
  if (!res) return [];
  if (!res.ok) { console.warn(`[naver ${kind}] ${res.status} ${query}${res.status === 429 ? " (일 허용량 초과)" : res.status === 401 || res.status === 403 ? " (키·헤더 확인)" : ""}`); return []; }
  const j = (await res.json()) as { items: { title: string; description: string; link: string; postdate?: string; pubDate?: string; bloggername?: string; cafename?: string }[] };
  return j.items.map((it) => ({ kind: kind === "cafearticle" ? "cafe" : kind, title: stripHtml(it.title), desc: stripHtml(it.description), url: it.link, date: it.postdate || it.pubDate, author: it.bloggername || it.cafename }));
}
async function youtube(query: string, max = 10): Promise<Hit[]> {
  if (!YT) return [];
  const res = await fetchRetry(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${max}&q=${encodeURIComponent(query)}&relevanceLanguage=ko&key=${YT}`);
  if (!res) return [];
  if (!res.ok) { console.warn(`[youtube] ${res.status} ${query}${res.status === 403 ? " (일 할당량 초과 가능)" : ""}`); return []; }
  const j = (await res.json()) as { items: { id: { videoId: string }; snippet: { title: string; description: string; channelTitle: string; publishedAt: string } }[] };
  return j.items.map((it) => ({ kind: "youtube" as Kind, title: it.snippet.title, desc: it.snippet.description, url: `https://www.youtube.com/watch?v=${it.id.videoId}`, date: it.snippet.publishedAt, author: it.snippet.channelTitle }));
}

const sql = dry ? null : connect();
const batch = `collect@${new Date().toISOString().slice(0, 16)}`;
const summary: string[] = [];
let totalIns = 0, totalDup = 0;
async function save(uniq: Candidate[], count: (c: Candidate) => number) {
  if (!sql) return { ins: 0, dup: 0 };
  let ins = 0, dup = 0;
  for (const c of uniq) {
    try {
      await sql`insert into pairing_candidates (drink_raw, food_raw, drink_id, food_id, source_name, url, quote, suggested_tier, suggested_score, origin, source_kind, query, mention_count, status, batch)
        values (${D[c.drinkId].name}, ${F[c.foodId].name}, ${c.drinkId}, ${c.foodId}, ${c.sourceName}, ${c.url}, ${c.quote}, ${c.tier}, ${c.tier === "media" ? 89 : 85}, 'crawl', ${c.kind}, ${c.query}, ${count(c)}, 'draft', ${batch})`;
      ins++;
    } catch (e) { if ((e as { code?: string }).code === "23505") dup++; else throw e; }
  }
  return { ins, dup };
}
try {
  for (const f of foods) {
    const name = f.name;
    const queries = [`"${name}" 전통주`, `"${name}" 막걸리`, `"${name}" 술 페어링`];
    const cands: Candidate[] = [];
    for (const q of queries) {
      if (useKinds.includes("blog")) cands.push(...extractForFood(f.id, q, await naver("blog", q)));
      if (useKinds.includes("cafe")) cands.push(...extractForFood(f.id, q, await naver("cafearticle", q, 30)));
      if (useKinds.includes("news")) cands.push(...extractForFood(f.id, q, await naver("news", q, 30)));
      if (useKinds.includes("youtube") && q.endsWith("전통주")) cands.push(...extractForFood(f.id, q, await youtube(q.replace(/"/g, ""))));
    }
    // 같은 URL, 그리고 보도자료 복사 기사(같은 술 + 같은 문장 끝 40자)는 한 번만
    const seen = new Set<string>(); const uniq = cands.filter((c) => {
      const k1 = c.drinkId + "|" + c.url, k2 = c.drinkId + "|" + c.quote.replace(/[^가-힣a-zA-Z0-9]/g, "").slice(-40);
      if (seen.has(k1) || seen.has(k2)) return false; seen.add(k1); seen.add(k2); return true;
    });
    const byDrink = new Map<string, number>(); for (const c of uniq) byDrink.set(c.drinkId, (byDrink.get(c.drinkId) || 0) + 1);
    const top = [...byDrink.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${D[id].name} ${n}`).join(" · ");
    summary.push(`| ${f.name} | ${uniq.length} | ${byDrink.size} | ${top} |`);
    if (dry && flag("show")) for (const c of uniq) console.log(`  ${D[c.drinkId].name} [${c.kind}] ${c.quote}`);
    const { ins, dup } = await save(uniq, (c) => byDrink.get(c.drinkId) || 1);
    totalIns += ins; totalDup += dup;
    console.log(`${f.name}: 후보 ${uniq.length} (술 ${byDrink.size}종) → 저장 ${ins} · 중복 ${dup}`);
  }
  for (const d of drinks) {
    const name = d.alias || d.name;
    // 이름이 일반 단어일 수 있어(서울의밤 등) 따옴표로 정확 구문 검색
    const queries = [`"${name}" 안주`, `"${name}" 페어링`, `"${name}" 어울리는 음식`];
    const cands: Candidate[] = [];
    for (const q of queries) {
      if (useKinds.includes("blog")) cands.push(...extract(d.id, q, await naver("blog", q)));
      if (useKinds.includes("cafe")) cands.push(...extract(d.id, q, await naver("cafearticle", q, 30)));
      if (useKinds.includes("news")) cands.push(...extract(d.id, q, await naver("news", q, 30)));
      if (useKinds.includes("youtube") && q.endsWith("안주")) cands.push(...extract(d.id, q, await youtube(q.replace(/"/g, ""))));
    }
    // (음식, URL) 중복 제거, (음식)별 언급 수
    const seen = new Set<string>(); const uniq = cands.filter((c) => { const k = c.foodId + "|" + c.url; if (seen.has(k)) return false; seen.add(k); return true; });
    const byFood = new Map<string, number>(); for (const c of uniq) byFood.set(c.foodId, (byFood.get(c.foodId) || 0) + 1);
    const top = [...byFood.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${F[id].name} ${n}`).join(" · ");
    summary.push(`| ${d.name} | ${uniq.length} | ${byFood.size} | ${top} |`);
    if (!sql) continue;
    let ins = 0, dup = 0;
    for (const c of uniq) {
      try {
        await sql`insert into pairing_candidates (drink_raw, food_raw, drink_id, food_id, source_name, url, quote, suggested_tier, suggested_score, origin, source_kind, query, mention_count, status, batch)
          values (${d.name}, ${F[c.foodId].name}, ${c.drinkId}, ${c.foodId}, ${c.sourceName}, ${c.url}, ${c.quote}, ${c.tier}, ${c.tier === "media" ? 89 : 85}, 'crawl', ${c.kind}, ${c.query}, ${byFood.get(c.foodId) || 1}, 'draft', ${batch})`;
        ins++;
      } catch (e) { if ((e as { code?: string }).code === "23505") dup++; else throw e; }
    }
    totalIns += ins; totalDup += dup;
    console.log(`${d.name}: 후보 ${uniq.length} (음식 ${byFood.size}종) → 저장 ${ins} · 중복 ${dup}`);
  }
  const md = (foodMode ? ["| 음식 | 후보 | 술 종류 | 상위 언급 |"] : ["| 술 | 후보 | 음식 종류 | 상위 언급 |"]).concat("|---|---|---|---|", summary).join("\n");
  writeFileSync("collect-report.md", `# 수집 보고 — ${batch}\n\n저장 ${totalIns} · 중복 ${totalDup} · 소스 ${useKinds.join(",")}\n\n${md}\n`);
  console.log(`수집 완료 — 저장 ${totalIns} · 중복 ${totalDup} → collect-report.md`);
} finally {
  await sql?.end();
}
