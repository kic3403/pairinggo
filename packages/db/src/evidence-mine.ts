/**
 * 후보 글 AI 1차 선별(2026-09-27, docs/26 §3-5 3단계 D5) — 모아 둔 draft 후보(블로그·카페·뉴스·유튜브)를
 * 원문 주소 × 술로 묶어 한 번 읽고, 음식마다 "그 술과 어울린다고 말하는가"를 판정해 pairing_candidates.ai_*에 적는다.
 *   1) 원문 읽기 — 블로그는 모바일 주소, 뉴스는 그대로, 유튜브는 Data API 설명글, 카페(로그인 벽)·못 읽은 곳은 검색 요약(snippet)으로
 *   2) 대목 고르기 — 술 이름과 음식 이름이 400자 안에 함께 나오는 곳만(shared coMentionWindows). 원문을 읽었는데 없으면 skip(부르지 않음)
 *   3) Claude 판정(server/evidence-mine.ts) → 인용문이 원문·요약에 글자 그대로 있고 음식 이름을 담아야 yes(shared finalizeMine)
 * 승인은 사람이 한다 — 어드민 /admin/review?view=ai. 승인하면 확인된 인용문이 근거 인용으로 들어간다.
 *
 *   pnpm --filter @pairinggo/db evidence-mine --dry --limit 200        원문만 읽어 대목 통계(비용 없음)
 *   pnpm --filter @pairinggo/db evidence-mine --limit 100              100묶음 판정(파일럿) — 끝에 토큰·비용 추정
 *   pnpm --filter @pairinggo/db evidence-mine --all [--kind blog,news] 남은 전부
 *   옵션: --model claude-sonnet-5 · --conc 6 · --redo(이미 본 것도 다시) · --random(무작위 순서 — 시험용)
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, coMentionWindows, drinkTermsOf, finalizeMine, foodTermsOf, htmlToText, isUnverifiableHost, squashText } from "@pairinggo/shared";
import { fetchPage } from "../../server/src/evidence-check";
import { MINE_MODEL_DEFAULT, emptyUsage, evidenceMineConfigured, judgeCoMentions, type MineUsage } from "../../server/src/evidence-mine";
import { connect } from "./sql";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (k: string) => process.argv.includes(k);
const DRY = has("--dry"), ALL = has("--all"), REDO = has("--redo");
const LIMIT = ALL ? 100_000 : Number(arg("--limit") ?? 50);
const KINDS = (arg("--kind") ?? "blog,cafe,news,youtube").split(",").map((s) => s.trim()).filter(Boolean);
const MODEL = arg("--model") ?? MINE_MODEL_DEFAULT;
const CONC = Math.max(1, Math.min(12, Number(arg("--conc") ?? 6)));

type Cand = { id: string; drink_id: string; food_id: string; url: string; quote: string | null; source_kind: string; source_name: string | null; mention_count: number; query: string | null };
type Group = { url: string; drinkId: string; kind: string; rows: Cand[] };

const D = new Map(DATA.drinks.map((d) => [d.id, d]));
const F = new Map(DATA.foods.map((f) => [f.id, f]));

/** 유튜브 설명글 — Data API(1 unit). 키가 없거나 실패하면 null */
async function youtubeText(url: string): Promise<string | null> {
  const key = process.env.YOUTUBE_API_KEY;
  const id = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1];
  if (!key || !id) return null;
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${key}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { items?: { snippet?: { title?: string; description?: string } }[] };
    const s = j.items?.[0]?.snippet;
    return s ? `${s.title ?? ""}\n${s.description ?? ""}` : null;
  } catch { return null; }
}

/** 원문 글자 + 근거로 쓸 수 있는지(basis). 못 읽으면 요약으로 */
async function sourceText(g: Group): Promise<{ basis: "page" | "snippet"; text: string; title: string | null }> {
  const snippets = g.rows.map((r) => r.quote ?? "").filter(Boolean).join("\n");
  if (g.kind === "youtube") {
    const t = await youtubeText(g.url);
    return t ? { basis: "page", text: t, title: t.split("\n")[0] } : { basis: "snippet", text: snippets, title: null };
  }
  if (isUnverifiableHost(g.url)) return { basis: "snippet", text: snippets, title: null };
  const page = await fetchPage(g.url, 10000);
  const text = page.status && page.status < 400 ? htmlToText(page.text) : "";
  if (squashText(text).length < 200) return { basis: "snippet", text: snippets, title: null };
  const title = page.text.match(/<title[^>]*>([^<]{2,160})<\/title>/i)?.[1]?.trim() ?? null;
  return { basis: "page", text, title };
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

const sql = connect();
const rows = await sql<Cand[]>`
  select id::text, drink_id, food_id, url, quote, source_kind, source_name, mention_count, query
  from pairing_candidates
  where status = 'draft' and url is not null and drink_id is not null and food_id is not null
    and source_kind = any(${KINDS}) ${REDO ? sql`` : sql`and ai_checked_at is null`}
  order by ${has("--random") ? sql`random()` : sql`mention_count desc, id`}`;
const byKey = new Map<string, Group>();
for (const r of rows) {
  if (!D.has(r.drink_id) || !F.has(r.food_id)) continue;   // 공개 카탈로그에 없는 술·음식(데모 등)
  const k = `${r.url}|${r.drink_id}`;
  const g = byKey.get(k) ?? { url: r.url, drinkId: r.drink_id, kind: r.source_kind, rows: [] };
  g.rows.push(r); byKey.set(k, g);
}
const groups = [...byKey.values()].slice(0, LIMIT);
console.log(`후보 ${rows.length}건 → 묶음 ${byKey.size}개 중 ${groups.length}개 처리${DRY ? " (--dry: 원문만 읽음)" : ` · 모델 ${MODEL}`}`);
if (!DRY && !evidenceMineConfigured()) { console.error("ANTHROPIC_API_KEY가 없습니다(apps/web/.env.local)."); process.exit(2); }

const usage: MineUsage = emptyUsage();
const tally: Record<string, number> = { yes: 0, no: 0, unclear: 0, skip: 0, unreadable: 0, error: 0 };
const basisTally: Record<string, number> = { page: 0, snippet: 0 };
const samples: { verdict: string; drink: string; food: string; quote: string | null; note: string; url: string }[] = [];
let done = 0;

async function save(ids: string[], v: { verdict: string; quote: string | null; reason: string | null; note: string; basis: string; model: string | null }) {
  if (DRY) return;
  await sql`update pairing_candidates set ai_verdict = ${v.verdict}, ai_quote = ${v.quote}, ai_reason = ${v.reason}, ai_note = ${v.note.slice(0, 200)},
    ai_basis = ${v.basis}, ai_model = ${v.model}, ai_checked_at = now() where id = any(${ids}::bigint[])`;
}

await pool(groups, CONC, async (g) => {
  const d = D.get(g.drinkId)!;
  const src = await sourceText(g);
  basisTally[src.basis]++;
  const dTerms = drinkTermsOf({ name: d.name, alias: d.alias, aliases: d.aliases, brewery: d.brewery }, g.rows.map((r) => r.query));
  const foodIds = [...new Set(g.rows.map((r) => r.food_id))];
  const snippets = g.rows.map((r) => r.quote ?? "").filter(Boolean);
  // 음식마다 대목 — 원문이면 함께 나오는 곳만, 요약이면 요약 자체(검색어가 이미 술 이름이라 요약엔 술 이름이 빠져 있기도 하다)
  const perFood = new Map<string, string[]>();
  for (const fid of foodIds) {
    const f = F.get(fid)!;
    const fTerms = foodTermsOf({ name: f.name, alias: f.alias });
    const w = src.basis === "page"
      ? coMentionWindows(src.text, dTerms, fTerms)
      : snippets.filter((s) => fTerms.some((t) => squashText(s).includes(squashText(t))));
    perFood.set(fid, w);
  }
  const ask = foodIds.filter((fid) => perFood.get(fid)!.length);
  for (const fid of foodIds.filter((x) => !ask.includes(x))) {
    const verdict = src.basis === "page" ? "skip" : "unreadable";
    tally[verdict]++;
    await save(g.rows.filter((r) => r.food_id === fid).map((r) => r.id), { verdict, quote: null, reason: null, note: src.basis === "page" ? "원문에서 두 이름이 가까이 나오지 않음" : "원문을 읽지 못했고 요약에도 음식 이름이 없음", basis: src.basis, model: null });
  }
  if (!ask.length) { done++; return; }
  const excerpts = [...new Set(ask.flatMap((fid) => perFood.get(fid)!))].slice(0, 5);
  if (DRY) { for (const _ of ask) tally.unclear++; done++; return; }
  try {
    const names = ask.map((fid) => F.get(fid)!.name);
    const res = await judgeCoMentions({ drink: { name: d.name, brewery: d.brewery, category: d.category, abv: d.abv }, foods: names, excerpts, kind: g.kind === "news" ? "뉴스 기사" : g.kind === "cafe" ? "카페 글(검색 요약)" : g.kind === "youtube" ? "유튜브 영상 설명" : src.basis === "page" ? "블로그 글" : "블로그 글(검색 요약)", title: src.title }, { model: MODEL, usage });
    for (const fid of ask) {
      const f = F.get(fid)!;
      const raw = res.items.find((x) => squashText(x.food) === squashText(f.name)) ?? { verdict: "unclear" as const, quote: "", reason: "", ad: false };
      const fin = finalizeMine(raw, { sources: [src.text, ...snippets], foodTerms: foodTermsOf({ name: f.name, alias: f.alias }) });
      tally[fin.verdict]++;
      if (samples.length < 400) samples.push({ verdict: fin.verdict, drink: d.name, food: f.name, quote: fin.quote, note: fin.note, url: g.url });
      await save(g.rows.filter((r) => r.food_id === fid).map((r) => r.id), { ...fin, basis: src.basis, model: res.model });
    }
  } catch (e) {
    tally.error += ask.length;
    console.warn(`  ! ${d.name} ${g.url} — ${(e as Error).message.slice(0, 120)}`);
  }
  if (++done % 50 === 0) console.log(`  … ${done}/${groups.length} · ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ")} · 입력 ${usage.input + usage.cacheRead} 출력 ${usage.output}`);
});

console.log(`\n묶음 ${groups.length} (원문 ${basisTally.page} · 요약 ${basisTally.snippet})`);
console.log(`판정 ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
if (!DRY) console.log(`Claude 호출 ${usage.calls} · 입력 ${usage.input.toLocaleString()} (캐시 읽기 ${usage.cacheRead.toLocaleString()} · 캐시 쓰기 ${usage.cacheWrite.toLocaleString()}) · 출력 ${usage.output.toLocaleString()} 토큰`);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "evidence-mine");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}${DRY ? "-dry" : ""}.json`), JSON.stringify({ at: new Date().toISOString(), model: DRY ? null : MODEL, groups: groups.length, basis: basisTally, tally, usage, samples }, null, 1));
await sql.end();
