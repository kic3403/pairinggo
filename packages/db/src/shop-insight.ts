/**
 * 네이버 쇼핑인사이트 수요 분석 — 앱에 없는 전통주 후보(더술닷컴 1,300종 + 수동 추가)와 현재 라인업의 쇼핑 클릭량을 같은 눈금으로 잰다.
 *   pnpm --filter @pairinggo/db shop-insight            (이미 잰 것은 건너뜀 — 중간에 끊겨도 이어서)
 *   pnpm --filter @pairinggo/db shop-insight --fresh    (처음부터)
 *   pnpm --filter @pairinggo/db shop-insight --blog     (쇼핑 클릭이 잡힌 이름을 네이버 블로그로 교차 확인 — 과일·다른 상품·관용구 걸러내기)
 * 결과: research/shop-insight.json → `pnpm --filter @pairinggo/db lineup`이 순위·선정에 쓴다.
 *
 * - 네이버 쇼핑 검색 API(상품 목록)는 2026-07-31 종료, 스마트스토어 자동 수집은 약관 위반 → 쇼핑인사이트(NAVER API HUB)만 쓴다.
 * - 카테고리: 식품(50000006) 전체. 전통주 세분류(막걸리/탁주 등)로 좁히면 종류가 다른 후보끼리 눈금이 달라지고, 작은 제품이 0으로 사라진다(실측).
 * - 요청마다 기준 키워드(ANCHOR)를 함께 넣어 기준 대비 배율로 바꾼다. 규칙은 packages/shared/src/lineup/lineup.ts.
 * - 키: packages/db/.env의 NCP_API_KEY_ID·NCP_API_KEY (채팅·커밋 금지)
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, categoryOfKind, drinkContextShare, keywordCore, relativeInterest, shopKeyword, type InsightPoint } from "@pairinggo/shared";
import { brewKey, loadResearch, norm, type ResearchProduct } from "./research";
import { SIDO_LABEL } from "./sido";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "shop-insight.json");
const CATEGORY = "50000006";
export const ANCHOR = "도깨비술";
const START = "2025-09-01", END = "2026-08-31";

export type Group = {
  key: string;
  /** "candidate" = 앱에 없는 후보, "catalog" = 현재 라인업(비교 기준) */
  kind: "candidate" | "catalog";
  keyword: string;
  params: string[];
  generic: boolean;
  /** 같은 묶음의 제품들(더술닷컴 id 또는 앱 술 id) */
  members: string[];
};
/** 블로그 검색 결과 수와 '술 이야기' 비율 — 쇼핑 클릭이 다른 상품 몫인지 가려낸다(`drinkContextShare`) */
export type BlogCheck = { query: string; total: number; share: number | null; hits: number };
export type InsightFile = {
  meta: { category: string; anchor: string; start: string; end: string; periods: string[]; ran_at: string };
  groups: Record<string, Group & { anchor?: InsightPoint[]; points?: InsightPoint[]; error?: string; blog?: BlogCheck }>;
};

const corpStrip = (s: string) => (s || "").replace(/농업회사법인|영농조합법인|농업법인|영농조합|협동조합|주식회사|유한회사|\(주\)|㈜|\(농\)|\(유\)|\(영\)|\(합\)|합자회사/g, "").replace(/\s+/g, " ").trim();

/** 지명 단어 — 시도 이름·약칭, 더술닷컴 시군구(시·군·구 뗀 것 포함), 앱 술 지역 */
export function placeWords(research: ResearchProduct[]): Set<string> {
  const w = new Set<string>();
  for (const v of Object.values(SIDO_LABEL)) { w.add(v); w.add(v.replace(/특별자치도|특별자치시|특별시|광역시|도$/g, "")); }
  for (const p of research) if (p.sigungu) { w.add(p.sigungu); w.add(p.sigungu.replace(/[시군구]$/, "")); }
  for (const d of DATA.drinks) for (const t of (d.region || "").split(/\s+/)) if (t.length >= 2) w.add(t);
  return w;
}

/** 앱에 이미 있는 제품인가 — 이름이 같거나, 검색어가 서로 포함(3글자 이상), 같은 양조장이면서 이름·별칭이 서로 포함 */
export function inCatalog(p: { name: string; brewery: string }): string | null {
  const pk = norm(shopKeyword(p.name));
  for (const d of DATA.drinks) {
    if (norm(d.name) === norm(p.name)) return d.id;
    const dk = norm(shopKeyword(d.name));
    if (pk.length >= 3 && dk.length >= 3 && (dk.includes(pk) || pk.includes(dk))) return d.id;
    if (d.brewery && brewKey(d.brewery) === brewKey(p.brewery)) {
      const a = norm(d.alias || d.name), n = norm(p.name);
      if (a.length >= 2 && (n.includes(a) || norm(d.name).includes(n))) return d.id;
    }
  }
  return null;
}

export function buildGroups(): Group[] {
  const research = loadResearch();
  const places = placeWords(research);
  const groups = new Map<string, Group>();
  const keyOf = (brewery: string, keyword: string) => `${brewKey(brewery)}|${norm(keyword)}`;
  const withBrewery = (brewery: string, k: string) => { const b = corpStrip(brewery); return b && !k.includes(b) ? `${b} ${k}` : k; };

  for (const p of research) {
    if (!categoryOfKind(p.kind, p.name, p.ingredients) || p.abv == null) continue;
    if (inCatalog(p)) continue;
    const base = shopKeyword(p.name);
    const core = keywordCore(base, places);
    const generic = core.length < 2;
    const keyword = generic ? withBrewery(p.brewery, base) : base;
    // API HUB 쇼핑인사이트는 키워드당 검색어 1개만 받는다(2026-09 실측). 브랜드가 한 글자만 남으면(원소주) 원래 이름, 하나도 안 남으면(생막걸리) 양조장 붙인 이름
    const params = [!generic || core.length === 1 ? base : keyword];
    const key = keyOf(p.brewery, keyword);
    const g = groups.get(key);
    if (g) { g.members.push(p.id); continue; }
    groups.set(key, { key, kind: "candidate", keyword, params, generic, members: [p.id] });
  }
  for (const d of DATA.drinks) {
    // 앱 별칭은 양조장 이름인 경우가 많아(두레박·배상면주가) 제품명 검색어를 쓴다
    const base = shopKeyword(d.name);
    const core = keywordCore(base, places);
    const generic = core.length < 2;
    const keyword = generic ? withBrewery(d.brewery || "", base) : base;
    const params = [!generic || core.length === 1 ? base : keyword];
    const key = `catalog|${d.id}`;
    groups.set(key, { key, kind: "catalog", keyword, params, generic, members: [d.id] });
  }
  return [...groups.values()];
}

function periodsOf(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`), e = new Date(`${end}T00:00:00Z`);
  while (d <= e) { out.push(d.toISOString().slice(0, 10)); d.setUTCMonth(d.getUTCMonth() + 1); }
  return out;
}

async function call(batch: Group[]): Promise<{ title: string; data: InsightPoint[] }[]> {
  const id = process.env.NCP_API_KEY_ID, key = process.env.NCP_API_KEY;
  if (!id || !key) throw new Error("NCP_API_KEY_ID·NCP_API_KEY가 packages/db/.env에 없습니다");
  const keyword = [{ name: `__anchor`, param: [ANCHOR] }, ...batch.map((g, i) => ({ name: `g${i}`, param: g.params.slice(0, 1) }))];
  const body = JSON.stringify({ startDate: START, endDate: END, timeUnit: "month", category: CATEGORY, keyword });
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://naverapihub.apigw.ntruss.com/shopping/v1/category/keywords", {
      method: "POST", body, signal: AbortSignal.timeout(15000),
      headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": key, "Content-Type": "application/json" },
    }).catch(() => null);
    if (!r || r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 1500 * (i + 1))); continue; }
    const j = await r.json() as { results?: { title: string; data: InsightPoint[] }[]; errMsg?: string };
    if (!r.ok || !j.results) throw new Error(`쇼핑인사이트 ${r.status}: ${j.errMsg ?? "응답 오류"}`);
    return j.results;
  }
  throw new Error("쇼핑인사이트 재시도 초과");
}

async function blogCheck(term: string): Promise<BlogCheck> {
  const id = process.env.NCP_API_KEY_ID!, key = process.env.NCP_API_KEY!;
  const query = `"${term}"`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://naverapihub.apigw.ntruss.com/search/v1/blog?query=${encodeURIComponent(query)}&display=50&sort=sim`, {
      headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": key }, signal: AbortSignal.timeout(12000),
    }).catch(() => null);
    if (!r || r.status === 429 || r.status >= 500) { await new Promise((x) => setTimeout(x, 1000 * (i + 1))); continue; }
    if (!r.ok) throw new Error(`blog ${r.status}`);
    const j = await r.json() as { total?: number; items?: { title?: string; description?: string }[] };
    const texts = (j.items ?? []).map((it) => `${it.title ?? ""} ${it.description ?? ""}`);
    return { query, total: j.total ?? 0, ...drinkContextShare(texts, term) };
  }
  throw new Error("blog 재시도 초과");
}

/** --blog: 쇼핑 클릭이 잡힌 묶음만 블로그로 한 번 더 확인 (이미 확인한 것은 건너뜀) */
async function runBlog(file: InsightFile) {
  const todo = Object.values(file.groups).filter((g) => g.points?.length && !g.blog && relativeInterest(g.points, g.anchor ?? [], file.meta.periods).total > 0);
  console.log(`블로그 확인 ${todo.length}개`);
  let n = 0;
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(todo.slice(i, i + 5).map(async (g) => {
      try { g.blog = await blogCheck(g.params[0]); } catch (e) { console.error(`  ${g.keyword}: ${(e as Error).message}`); }
    }));
    n += Math.min(5, todo.length - i);
    if (n % 100 < 5) { writeFileSync(OUT, JSON.stringify(file)); console.log(`  ${n}/${todo.length}`); }
  }
  writeFileSync(OUT, JSON.stringify(file));
}

async function main() {
  if (process.argv.includes("--blog")) {
    if (!existsSync(OUT)) throw new Error("먼저 쇼핑인사이트를 재세요(인자 없이 실행)");
    await runBlog(JSON.parse(readFileSync(OUT, "utf8")));
    console.log(`완료 → ${OUT}`);
    return;
  }
  const fresh = process.argv.includes("--fresh");
  const periods = periodsOf(START, END);
  const prev: InsightFile | null = !fresh && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const same = prev && prev.meta.anchor === ANCHOR && prev.meta.start === START && prev.meta.end === END;
  const file: InsightFile = { meta: { category: CATEGORY, anchor: ANCHOR, start: START, end: END, periods, ran_at: new Date().toISOString() }, groups: {} };
  const groups = buildGroups();
  const todo: Group[] = [];
  for (const g of groups) {
    const old = same ? prev!.groups[g.key] : undefined;
    if (old?.points && old.anchor && JSON.stringify(old.params) === JSON.stringify(g.params)) file.groups[g.key] = { ...g, anchor: old.anchor, points: old.points, blog: old.blog };
    else { file.groups[g.key] = { ...g }; todo.push(g); }
  }
  console.log(`묶음 ${groups.length}개 (후보 ${groups.filter((g) => g.kind === "candidate").length} · 현재 라인업 ${groups.filter((g) => g.kind === "catalog").length}) · 새로 잴 것 ${todo.length} · 요청 ${Math.ceil(todo.length / 4)}회`);
  let done = 0;
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    try {
      const res = await call(batch);
      const anchor = res.find((x) => x.title === "__anchor")?.data ?? [];
      batch.forEach((g, k) => { file.groups[g.key] = { ...g, anchor, points: res.find((x) => x.title === `g${k}`)?.data ?? [] }; });
    } catch (e) {
      batch.forEach((g) => { file.groups[g.key] = { ...g, error: (e as Error).message }; });
      console.error(`  ${batch.map((g) => g.keyword).join(", ")} → ${(e as Error).message}`);
      if (/401|403|한도|quota|limit/i.test((e as Error).message)) break;
    }
    done += batch.length;
    if (done % 80 === 0 || done === todo.length) { writeFileSync(OUT, JSON.stringify(file)); console.log(`  ${done}/${todo.length}`); }
    await new Promise((s) => setTimeout(s, 120));
  }
  writeFileSync(OUT, JSON.stringify(file));
  const measured = Object.values(file.groups).filter((g) => g.points);
  console.log(`완료 → ${OUT} · 잰 묶음 ${measured.length} · 값 있음 ${measured.filter((g) => g.points!.length).length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
