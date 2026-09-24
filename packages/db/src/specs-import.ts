/**
 * 규격·참고가격 가져오기(2026-09-24, docs/23) — 엑셀/CSV 한 줄 = 술 × 규격 × 가격 하나.
 *   pnpm --filter @pairinggo/db specs-import <파일.xlsx|.csv>            미리보기(DB 안 건드림)
 *   pnpm --filter @pairinggo/db specs-import <파일.xlsx|.csv> --apply    반영 + 발행 → 이어서 `export`
 * 열 순서(템플릿 '규격·가격' 시트): 술(id 또는 이름) · 용량(mL) · 도수 · 빈티지 · 병수 · 가격(원) · 가격유형(msrp|retail) · 출처 · 출처URL · 확인일 · 메모
 *  · 용량은 "720ml"·"1.8L"도 되고 mL 정수로 저장. 비우면 미확인(null) — 0은 넣지 않는다.
 *  · 가격이 비면 규격만 만든다(가격 정보 없음). 0원은 거부.
 *  · 병수 2 이상이면 세트 규격(pack=set) — 한 병 필터에서 빠진다.
 *  · 같은 규격(술·용량·빈티지·병수)의 기존 유효 가격은 valid=false로 내리고 새 가격을 더한다(이력 보존).
 */
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { cleanDate, cleanPrice, parseMl, type SpecPrice } from "@pairinggo/shared";
import { publishCatalog } from "./catalog-write";
import { matchEntity } from "./entity";
import { connect } from "./sql";

type Row = { drink: string; ml: string; abv: string; vintage: string; bottles: string; krw: string; type: string; source: string; url: string; checked: string; note: string };
const file = process.argv[2];
const apply = process.argv.includes("--apply");
if (!file) { console.error("사용: specs-import <파일.xlsx|.csv> [--apply]"); process.exit(2); }

async function readRows(path: string): Promise<Row[]> {
  const mk = (c: string[]): Row => ({ drink: c[0] ?? "", ml: c[1] ?? "", abv: c[2] ?? "", vintage: c[3] ?? "", bottles: c[4] ?? "", krw: c[5] ?? "", type: c[6] ?? "", source: c[7] ?? "", url: c[8] ?? "", checked: c[9] ?? "", note: c[10] ?? "" });
  if (path.toLowerCase().endsWith(".csv")) {
    const text = readFileSync(path, "utf8").replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const parse = (l: string) => { const out: string[] = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
    return lines.slice(1).map(parse).map(mk).filter((r) => r.drink);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("규격·가격") ?? wb.worksheets[0];
  const rows: Row[] = [];
  const val = (c: ExcelJS.Cell) => { const v = c.value as unknown; if (v == null) return ""; if (v instanceof Date) return v.toISOString().slice(0, 10); if (typeof v === "object" && v && "text" in (v as object)) return String((v as { text: string }).text); if (typeof v === "object" && v && "hyperlink" in (v as object)) return String((v as { hyperlink: string }).hyperlink); if (typeof v === "object" && v && "result" in (v as object)) return String((v as { result: unknown }).result ?? ""); return String(v); };
  ws.eachRow((row, n) => { if (n === 1) return; const c = Array.from({ length: 11 }, (_, i) => val(row.getCell(i + 1)).trim()); if (c[0]) rows.push(mk(c)); });
  return rows;
}

type SpecKey = { drinkId: string; ml: number | null; vintage: string | null; pack: "bottle" | "set"; bottles: number };
const keyOf = (k: SpecKey) => `${k.drinkId}|${k.ml ?? "?"}|${k.vintage ?? ""}|${k.pack}|${k.bottles}`;

const sql = connect();
try {
  const rows = await readRows(file);
  const specs = new Map<string, SpecKey & { abv: number | null; note: string | null; prices: SpecPrice[]; name: string }>();
  const problems: string[] = [];
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    if (/^예시/.test(r.note)) continue;   // 템플릿 예시 줄
    const m = r.drink.match(/^d\d+$/) ? { id: r.drink, name: r.drink, confidence: "exact" as const } : matchEntity(r.drink, "drink");
    if (!m.id || m.confidence !== "exact") { problems.push(`${line}행: 술 '${r.drink}'을 카탈로그에서 정확히 찾지 못함${m.name ? ` (비슷한 이름: ${m.name})` : ""}`); continue; }
    const ml = parseMl(r.ml);
    if (r.ml && ml == null) { problems.push(`${line}행: 용량 '${r.ml}'을 읽을 수 없음(0·문자 금지)`); continue; }
    const bottles = Math.max(1, Math.floor(Number(r.bottles || 1)) || 1);
    const key: SpecKey = { drinkId: m.id, ml, vintage: r.vintage.trim() || null, pack: bottles >= 2 ? "set" : "bottle", bottles };
    const abvN = r.abv ? Number(r.abv.replace(/[%도]/g, "")) : NaN;
    const cur = specs.get(keyOf(key)) ?? { ...key, abv: Number.isFinite(abvN) ? abvN : null, note: r.note.trim() || null, prices: [], name: m.name ?? m.id };
    if (r.krw) {
      const p = cleanPrice({ krw: r.krw, type: r.type.trim().toLowerCase(), source: r.source, url: r.url, checked: cleanDate(r.checked) ?? r.checked });
      if (!p) { problems.push(`${line}행: 가격 행이 불완전 — 금액(0 금지)·출처·확인일(YYYY-MM-DD)이 모두 있어야 함`); continue; }
      cur.prices.push(p);
    }
    specs.set(keyOf(key), cur);
  }
  console.log(`읽음 ${rows.length}행 → 규격 ${specs.size}개(가격 ${[...specs.values()].reduce((a, s) => a + s.prices.length, 0)}건)`);
  for (const s of specs.values()) console.log(`  ${s.drinkId} ${s.name} · ${s.ml != null ? `${s.ml}mL` : "용량 미확인"}${s.vintage ? ` · ${s.vintage}` : ""}${s.pack === "set" ? ` · ${s.bottles}병 세트` : ""}${s.prices.length ? ` · ${s.prices.map((p) => `${p.krw.toLocaleString()}원(${p.type}, ${p.source}, ${p.checked})`).join(" / ")}` : " · 가격 없음"}`);
  if (problems.length) { console.log(`\n건너뛴 줄 ${problems.length}`); for (const p of problems) console.log("  ✗ " + p); }
  if (!apply) { console.log("\n미리보기입니다. 반영하려면 --apply"); }
  else if (!specs.size) console.log("반영할 규격이 없습니다.");
  else {
    let newSpecs = 0, newPrices = 0, retired = 0;
    await sql.begin(async (tx) => {
      for (const s of specs.values()) {
        const found = await tx<{ id: number }[]>`select id from drink_specs where drink_id = ${s.drinkId} and volume_ml is not distinct from ${s.ml} and vintage is not distinct from ${s.vintage} and pack = ${s.pack} and bottles = ${s.bottles} limit 1`;
        let specId = found[0]?.id;
        if (!specId) {
          const [{ mx }] = await tx<{ mx: number | null }[]>`select max(sort) as mx from drink_specs where drink_id = ${s.drinkId}`;
          const [row] = await tx<{ id: number }[]>`insert into drink_specs (drink_id, volume_ml, abv, vintage, pack, bottles, note, sort) values (${s.drinkId}, ${s.ml}, ${s.abv}, ${s.vintage}, ${s.pack}, ${s.bottles}, ${s.note}, ${(mx ?? -1) + 1}) returning id`;
          specId = row.id; newSpecs++;
        } else if (s.abv != null || s.note) await tx`update drink_specs set abv = coalesce(${s.abv}, abv), note = coalesce(${s.note}, note), updated_at = now() where id = ${specId}`;
        if (s.prices.length) {
          const r = await tx`update drink_prices set valid = false where spec_id = ${specId} and valid`;
          retired += r.count;
          for (const p of s.prices) { await tx`insert into drink_prices (spec_id, krw, price_type, source, source_url, checked_on) values (${specId}, ${p.krw}, ${p.type}, ${p.source}, ${p.url ?? null}, ${p.checked})`; newPrices++; }
        }
      }
    });
    console.log(`반영 — 새 규격 ${newSpecs} · 새 가격 ${newPrices} · 이전 가격 무효 처리 ${retired}`);
    await publishCatalog(sql, `규격·가격 가져오기 ${specs.size}규격`);
    console.log("발행 완료 — 이어서 `export`");
  }
} finally {
  await sql.end();
}
