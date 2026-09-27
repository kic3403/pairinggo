/**
 * 양조장 공식 페이지 추천 안주(2026-09-27, docs/26 §3-5 3단계 D2) — 양조장 공식몰·공식 홈페이지의 그 술 소개에서
 * "이 술엔 ○○이 어울린다" 문장을 뽑아 official 후보로 넣는다(사람 검수 뒤 승격).
 *   · 대상: 구매 링크가 양조장 공식몰·공식 홈페이지인 술(스마트스토어·소매점·오픈마켓 제외) + 공공데이터 전통주정보의 홈페이지 주소
 *   · robots.txt가 막은 경로는 열지 않는다. 한 페이지씩 읽기(크롤 아님), 사이트마다 한 번에 하나
 *   · 그 술 이름이 보이는 페이지에서 추천 낱말(어울·안주·곁들·페어링·궁합…)이 술 이름 가까이 나오는 대목만 Claude에 보낸다
 *   · Claude가 고른 문장이 페이지에 글자 그대로 있고 음식 이름을 담아야 후보로 넣는다. 카탈로그에 없는 음식은 보고서에만(음식 추가 참고)
 *   · 읽은 결과는 official_page_checks(0044) — 90일 안에 본 술은 건너뛴다(--redo로 다시)
 *
 *   pnpm --filter @pairinggo/db official-pairings --dry        대상·robots·대목만(비용 없음)
 *   pnpm --filter @pairinggo/db official-pairings [--limit N] [--model …]
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, coMentionWindows, drinkTermsOf, foodTermsOf, htmlToText, quoteHasTerm, quoteVerbatim, squashText, termPositions } from "@pairinggo/shared";
import { fetchPage } from "../../server/src/evidence-check";
import { MINE_MODEL_DEFAULT, emptyUsage, evidenceMineConfigured, extractOfficialPairings, type MineUsage } from "../../server/src/evidence-mine";
import { connect } from "./sql";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (k: string) => process.argv.includes(k);
const DRY = has("--dry"), REDO = has("--redo");
const LIMIT = Number(arg("--limit") ?? 100_000);
const MODEL = arg("--model") ?? MINE_MODEL_DEFAULT;
const BATCH = `official-${new Date().toISOString().slice(0, 10)}`;
const here = dirname(fileURLToPath(import.meta.url));

/** 공식이 아닌 판매처 — 스마트스토어·네이버쇼핑·소매점·오픈마켓·펀딩·지자체몰 */
const NOT_OFFICIAL_HOST = /(smartstore\.naver|shopping\.naver|naver\.me|kihya|sulmarket|sooldamhwa|dailyshot|sullove|zzann|epost|11st|gmarket|auction|coupang|wadiz|tumblbug|modoo\.at|ddinggul|kakao)/i;
const NOT_OFFICIAL_STORE = /(스마트스토어|키햐|술마켓|술담화|전통주몰|우체국|11번가|와디즈|지자체몰|띵굴|별주막|전통주애)/;
/** 술 이름 가까이서 찾을 추천 낱말(literal — coMentionWindows의 '음식' 자리에 넣는다) */
const PAIR_TERMS = ["어울", "안주", "곁들", "페어링", "궁합", "함께 드", "함께 즐기", "함께 먹", "잘 맞", "마리아주", "추천 음식"];

type Target = { drinkId: string; url: string; from: "buy" | "datago" };
const D = new Map(DATA.drinks.map((d) => [d.id, d]));
const foodByName = new Map<string, string>();
for (const f of DATA.foods) foodByName.set(squashText(f.name), f.id);   // 정식 이름이 먼저
for (const f of DATA.foods) for (const t of foodTermsOf({ name: f.name, alias: f.alias })) if (!foodByName.has(squashText(t))) foodByName.set(squashText(t), f.id);

/* ---------- robots.txt ---------- */
const robotsCache = new Map<string, { allow: string[]; disallow: string[] } | null>();
async function robotsAllows(url: string): Promise<boolean> {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    let rules: { allow: string[]; disallow: string[] } | null = null;
    try {
      const r = await fetch(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0 (compatible; PairingGO-evidence-check/1.0)" } });
      if (r.ok) {
        rules = { allow: [], disallow: [] };
        let applies = false, sawAgent = false;
        for (const raw of (await r.text()).split(/\r?\n/)) {
          const line = raw.replace(/#.*/, "").trim();
          const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
          if (!m) continue;
          const k = m[1].toLowerCase(), v = m[2].trim();
          if (k === "user-agent") { if (sawAgent && !applies) { /* 새 묶음 */ } applies = v === "*" || /pairinggo/i.test(v); sawAgent = true; continue; }
          if (!applies) continue;
          if (k === "disallow" && v) rules.disallow.push(v);
          if (k === "allow" && v) rules.allow.push(v);
        }
      }
    } catch { rules = null; }
    robotsCache.set(u.origin, rules);
  }
  const rules = robotsCache.get(u.origin);
  if (!rules) return true;
  const path = u.pathname + u.search;
  const hit = (p: string) => { const re = new RegExp("^" + p.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*").replace(/\\\$$/, "$")); return re.test(path); };
  const dis = Math.max(-1, ...rules.disallow.filter(hit).map((p) => p.length));
  const al = Math.max(-1, ...rules.allow.filter(hit).map((p) => p.length));
  return dis < 0 || al >= dis;
}

/* ---------- 대상 ---------- */
function targets(): Target[] {
  const out: Target[] = [];
  for (const d of DATA.drinks) {
    const url = d.buy?.url, store = d.buy?.store ?? "";
    if (url && /^https?:/.test(url) && !NOT_OFFICIAL_HOST.test(url) && !NOT_OFFICIAL_STORE.test(store)) out.push({ drinkId: d.id, url, from: "buy" });
  }
  // 공공데이터 홈페이지 — 대조된 술만, 구매 링크와 다른 사이트일 때
  try {
    const raw = JSON.parse(readFileSync(join(here, "..", "research", "datago", "전통주정보.json"), "utf8")) as { rows: Record<string, string | null>[] };
    const rep = JSON.parse(readFileSync(join(here, "..", "research", "datago", "match-report.json"), "utf8")) as { items: { id: string; apiName: string; brewery: string }[] };
    for (const it of rep.items) {
      const row = raw.rows.find((r) => r["제품명"] === it.apiName && (r["양조장"] ?? "") === (it.brewery ?? ""));
      let home = String(row?.["홈페이지주소"] ?? "").trim();
      if (!home || !D.has(it.id)) continue;
      if (!/^https?:\/\//.test(home)) home = `http://${home}`;
      if (NOT_OFFICIAL_HOST.test(home)) continue;
      const host = (s: string) => { try { return new URL(s).hostname.replace(/^www\./, ""); } catch { return s; } };
      if (out.some((t) => t.drinkId === it.id && host(t.url) === host(home))) continue;
      out.push({ drinkId: it.id, url: home, from: "datago" });
    }
  } catch { /* 공공데이터 파일이 없으면 구매 링크만 */ }
  return out;
}

const sql = connect();
const seen = new Set((REDO ? [] : await sql<{ drink_id: string; url: string }[]>`select drink_id, url from official_page_checks where checked_at > now() - interval '90 days'`).map((r) => `${r.drink_id}|${r.url}`));
const list = targets().filter((t) => !seen.has(`${t.drinkId}|${t.url}`)).slice(0, LIMIT);
console.log(`공식 페이지 대상 ${list.length}곳 (구매 링크 ${list.filter((t) => t.from === "buy").length} · 공공데이터 홈페이지 ${list.filter((t) => t.from === "datago").length})${DRY ? " — --dry" : ` · 모델 ${MODEL}`}`);
if (!DRY && !evidenceMineConfigured()) { console.error("ANTHROPIC_API_KEY가 없습니다(apps/web/.env.local)."); process.exit(2); }

const usage: MineUsage = emptyUsage();
const tally: Record<string, number> = { found: 0, none: 0, blocked: 0, skipped: 0, inserted: 0, dup: 0, unverified: 0 };
const unknownFoods: Record<string, string[]> = {};
const found: { drink: string; food: string; quote: string; url: string }[] = [];
const foodNames = DATA.foods.map((f) => f.name);

async function record(t: Target, status: string, n: number, note: string) {
  tally[status] = (tally[status] ?? 0) + 1;
  if (DRY) return;
  await sql`insert into official_page_checks (drink_id, url, status, found, note, checked_at) values (${t.drinkId}, ${t.url}, ${status}, ${n}, ${note.slice(0, 200)}, now())
    on conflict (drink_id, url) do update set status = excluded.status, found = excluded.found, note = excluded.note, checked_at = now()`;
}

// 같은 사이트는 차례로(한 번에 하나), 사이트끼리는 동시에 4곳
const byHost = new Map<string, Target[]>();
for (const t of list) { const h = new URL(t.url).hostname; byHost.set(h, [...(byHost.get(h) ?? []), t]); }
const hosts = [...byHost.values()];
let hi = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (hi < hosts.length) {
    for (const t of hosts[hi++]) {
      const d = D.get(t.drinkId)!;
      try {
        if (!(await robotsAllows(t.url))) { await record(t, "blocked", 0, "robots.txt가 막은 경로"); continue; }
        const page = await fetchPage(t.url, 12000);
        const text = page.status && page.status < 400 ? htmlToText(page.text) : "";
        if (squashText(text).length < 200) { await record(t, "blocked", 0, `읽지 못함(${page.status ?? "연결 실패"})`); continue; }
        const dTerms = drinkTermsOf({ name: d.name, alias: d.alias, aliases: d.aliases, brewery: d.brewery });
        if (!termPositions(text, dTerms).length) { await record(t, "skipped", 0, "페이지에 술 이름이 없음"); continue; }
        const windows = coMentionWindows(text, dTerms, PAIR_TERMS, { near: 700, pad: 300, max: 4 });
        if (!windows.length) { await record(t, "skipped", 0, "술 이름 가까이 추천 낱말이 없음"); continue; }
        if (DRY) { await record(t, "found", 0, `대목 ${windows.length}개`); continue; }
        const res = await extractOfficialPairings({ drink: { name: d.name, brewery: d.brewery, category: d.category, abv: d.abv }, excerpts: windows, url: t.url }, foodNames, { model: MODEL, usage });
        let n = 0;
        for (const it of res.items) {
          const fid = it.catalog_food ? foodByName.get(squashText(it.catalog_food)) ?? foodByName.get(squashText(it.food_text)) : foodByName.get(squashText(it.food_text));
          if (!fid) { (unknownFoods[it.food_text] ??= []).push(d.name); continue; }
          const f = DATA.foods.find((x) => x.id === fid)!;
          const terms = [it.food_text, ...foodTermsOf({ name: f.name, alias: f.alias })];
          const quote = it.quote.replace(/\s+/g, " ").trim().slice(0, 300);
          if (!quoteVerbatim(quote, [text]) || !quoteHasTerm(quote, terms)) { tally.unverified++; continue; }
          const store = d.buy?.store && t.from === "buy" ? d.buy.store : "공식 홈페이지";
          const src = `${d.brewery ?? d.name} ${store.replace(/^양조장\s*/, "")}`.slice(0, 80);
          const ins = await sql`insert into pairing_candidates (drink_id, food_id, drink_raw, food_raw, source_name, url, quote, suggested_tier, suggested_score, suggested_reason, origin, status, source_kind, batch,
              ai_verdict, ai_quote, ai_reason, ai_note, ai_basis, ai_model, ai_checked_at)
            values (${d.id}, ${fid}, ${d.name}, ${it.food_text}, ${src}, ${t.url}, ${quote}, 'official', 96, ${it.reason.slice(0, 80) || null}, 'ai', 'draft', 'brewery', ${BATCH},
              'yes', ${quote}, ${it.reason.slice(0, 80) || null}, ${"양조장 공식 페이지"}, 'page', ${res.model}, now())
            on conflict do nothing returning id`;
          if (ins.length) { tally.inserted++; n++; found.push({ drink: d.name, food: f.name, quote, url: t.url }); } else tally.dup++;
        }
        await record(t, res.items.length ? "found" : "none", n, res.aboutThisDrink ? `추천 ${res.items.length} · 넣음 ${n}` : "다른 제품 소개");
      } catch (e) {
        await record(t, "blocked", 0, `오류: ${(e as Error).message}`);
      }
    }
  }
}));

console.log(`결과 ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
if (!DRY) console.log(`Claude 호출 ${usage.calls} · 입력 ${usage.input.toLocaleString()} (캐시 읽기 ${usage.cacheRead.toLocaleString()}) · 출력 ${usage.output.toLocaleString()} 토큰`);
const out = join(here, "..", "research", "official-pairings");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${BATCH}${DRY ? "-dry" : ""}.json`), JSON.stringify({ at: new Date().toISOString(), tally, usage, found, unknownFoods }, null, 1));
await sql.end();
