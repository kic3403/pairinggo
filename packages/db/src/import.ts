/**
 * 엑셀/CSV 가져오기 → pairing_candidates (origin: sheet)
 *   pnpm db:import <파일.xlsx|.csv> [--batch 이름] [--who "기본 추천자"] [--tier blog]
 * 술·음식 이름은 카탈로그에 자동 매칭(정확·접두·별칭). 못 찾으면 needs_entity로 넣고 import-report.md에 적는다.
 * (술, 음식, URL) 중복은 건너뛴다. 출처명·도메인은 sources에 upsert.
 */
import ExcelJS from "exceljs";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { connect } from "./sql";
import { domainOf, matchEntity } from "./entity";

type Tier = "official" | "sommelier" | "media" | "blog" | "user";
const TIER_DEFAULT: Record<Tier, number> = { official: 96, sommelier: 93, media: 89, blog: 85, user: 85 };
const TIERS = new Set<string>(Object.keys(TIER_DEFAULT));
export type Row = { drink: string; food: string; reason?: string; source?: string; url?: string; quote?: string; who?: string; tier?: string; score?: number | string; note?: string };

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
if (!file) { console.error("사용법: pnpm db:import <파일.xlsx|.csv> [--batch 이름] [--who 기본추천자] [--tier blog]"); process.exit(2); }
const batch = opt("batch") || `${basename(file)}@${new Date().toISOString().slice(0, 16)}`;
const defaultWho = opt("who") || null;
const defaultTier = (opt("tier") as Tier) || "blog";

async function readRows(path: string): Promise<Row[]> {
  if (path.toLowerCase().endsWith(".csv")) {
    const text = readFileSync(path, "utf8").replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const parse = (l: string) => { const out: string[] = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
    const head = parse(lines[0]).map((h) => h.replace(/\*|\(.*\)/g, "").trim());
    const idx = (names: string[]) => head.findIndex((h) => names.some((n) => h.startsWith(n)));
    const ci = { drink: idx(["술이름", "drink"]), food: idx(["음식이름", "food"]), reason: idx(["추천이유", "reason"]), source: idx(["출처명", "source"]), url: idx(["출처URL", "url"]), quote: idx(["인용문", "quote"]), who: idx(["추천자", "who"]), tier: idx(["출처등급", "tier"]), score: idx(["점수", "score"]), note: idx(["메모", "note"]) };
    return lines.slice(1).map(parse).map((c) => ({ drink: c[ci.drink] || "", food: c[ci.food] || "", reason: c[ci.reason], source: c[ci.source], url: c[ci.url], quote: c[ci.quote], who: c[ci.who], tier: c[ci.tier], score: c[ci.score], note: c[ci.note] }));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("후보") || wb.worksheets[0];
  const rows: Row[] = [];
  const val = (c: ExcelJS.Cell) => { const v = c.value as unknown; if (v == null) return ""; if (typeof v === "object" && v && "text" in (v as object)) return String((v as { text: string }).text); if (typeof v === "object" && v && "hyperlink" in (v as object)) return String((v as { hyperlink: string }).hyperlink); if (typeof v === "object" && v && "result" in (v as object)) return String((v as { result: unknown }).result ?? ""); return String(v); };
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const c = (i: number) => val(row.getCell(i)).trim();
    const r: Row = { drink: c(1), food: c(2), reason: c(3), source: c(4), url: c(5), quote: c(6), who: c(7), tier: c(8), score: c(9), note: c(10) };
    if (!r.drink && !r.food) return;
    rows.push(r);
  });
  return rows;
}

const EXAMPLE_URLS = new Set(["https://boksoon.com", "https://example.com/interview", "https://www.mk.co.kr/..."]);

const sql = connect();
try {
  const rows = await readRows(file);
  const report: string[] = [`# 가져오기 보고 — ${batch}`, ""];
  let ok = 0, needs = 0, dup = 0, skipped = 0;
  for (const [i, r] of rows.entries()) {
    if (r.url && EXAMPLE_URLS.has(r.url)) { skipped++; continue; }  // 템플릿 예시 행
    const d = matchEntity(r.drink, "drink"), f = matchEntity(r.food, "food");
    const tier: Tier = TIERS.has((r.tier || "").trim()) ? (r.tier!.trim() as Tier) : defaultTier;
    const scoreNum = Number(r.score);
    const score = Number.isFinite(scoreNum) && scoreNum >= 84 && scoreNum <= 97 ? Math.round(scoreNum) : TIER_DEFAULT[tier];
    const status = d.confidence === "exact" && f.confidence === "exact" ? "draft" : "needs_entity";
    const url = (r.url || "").trim() || null;
    const source = (r.source || "").trim() || null;
    let sourceId: number | null = null;
    if (source) {
      const [s] = await sql<{ id: number }[]>`insert into sources (name, domain, kind, default_tier) values (${source}, ${domainOf(url)}, ${tier === "official" ? "brewery" : tier === "sommelier" ? "sommelier" : tier === "media" ? "media" : tier === "user" ? "user" : "blog"}, ${tier})
        on conflict (name, domain) do update set name = excluded.name returning id`;
      sourceId = s.id;
    }
    try {
      await sql`insert into pairing_candidates (drink_raw, food_raw, drink_id, food_id, source_id, source_name, url, quote, who, suggested_tier, suggested_score, suggested_reason, origin, source_kind, status, batch, review_note)
        values (${r.drink}, ${r.food}, ${d.confidence === "exact" ? d.id : null}, ${f.confidence === "exact" ? f.id : null}, ${sourceId}, ${source}, ${url}, ${(r.quote || "").slice(0, 300) || null}, ${(r.who || "").trim() || defaultWho}, ${tier}, ${score}, ${(r.reason || "").trim() || null}, 'sheet', 'sheet', ${status}, ${batch}, ${(r.note || "").trim() || null})`;
      if (status === "draft") ok++; else { needs++; report.push(`- ${i + 2}행: 술 "${r.drink}" → ${d.name ?? "없음"}(${d.confidence}) · 음식 "${r.food}" → ${f.name ?? "없음"}(${f.confidence})`); }
    } catch (e) {
      if ((e as { code?: string }).code === "23505") dup++; else throw e;
    }
  }
  report.unshift(`성공 ${ok} · 확인 필요 ${needs} · 중복 ${dup} · 예시 건너뜀 ${skipped}`);
  writeFileSync("import-report.md", report.join("\n"));
  console.log(`가져오기 완료 — 성공 ${ok} · 확인 필요 ${needs} · 중복 ${dup} · 예시 건너뜀 ${skipped} · 배치 ${batch}`);
  if (needs) console.log(`확인 필요 목록 → import-report.md`);
} finally {
  await sql.end();
}
