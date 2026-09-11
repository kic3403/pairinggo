/**
 * 인스타그램 해시태그 게시물 수 수동 입력 → drink_mentions_daily(channel=insta)
 *   pnpm --filter @pairinggo/db mentions:insta <파일.csv> [--day 2026-09-12]
 * CSV: 첫 줄 머리글, 열 = 술이름(또는 별칭·ID), 게시물수(최근 30일). 예)
 *   술이름,게시물수
 *   서울의밤,73
 *   복순도가,22
 * 인스타그램은 공식 API로 해시태그 게시물 수를 받을 수 없어(그래프 API는 비즈니스 계정+심사, 개수 미제공) 앱에서 직접 세어 넣는다.
 * 넣은 값은 다음 00:00 크론 때 다른 채널과 함께 평균에 들어간다(7일 안의 값만 쓴다 — 매주 한 번은 갱신).
 */
import { readFileSync } from "node:fs";
import { DATA } from "@pairinggo/shared";
import { connect } from "./sql";

const file = process.argv[2];
if (!file) { console.error("사용법: pnpm --filter @pairinggo/db mentions:insta <파일.csv> [--day YYYY-MM-DD]"); process.exit(2); }
const dayArg = process.argv.indexOf("--day");
const day = dayArg > 0 ? process.argv[dayArg + 1] : new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const byKey = new Map<string, string>();
for (const d of DATA.drinks) { byKey.set(norm(d.id), d.id); byKey.set(norm(d.name), d.id); if (d.alias) byKey.set(norm(d.alias), d.id); }

const lines = readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const rows: { drink_id: string; count: number; query: string }[] = [];
const missing: string[] = [];
for (const line of lines.slice(1)) {
  const [name, cnt] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const id = byKey.get(norm(name || ""));
  const count = parseInt(cnt || "", 10);
  if (!id) { missing.push(name); continue; }
  if (!Number.isFinite(count) || count < 0) { missing.push(`${name}(숫자 아님: ${cnt})`); continue; }
  rows.push({ drink_id: id, count, query: name });
}
if (missing.length) console.warn(`이름을 못 찾았거나 값이 이상한 행 ${missing.length}: ${missing.join(", ")}`);
if (!rows.length) { console.error("넣을 행이 없습니다."); process.exit(1); }

const sql = connect();
try {
  await sql.begin(async (tx) => {
    for (const r of rows) {
      await tx`insert into drink_mentions_daily (day, drink_id, channel, count, window_days, query, raw)
               values (${day}, ${r.drink_id}, 'insta', ${r.count}, 30, ${r.query}, ${JSON.stringify({ source: "manual" })}::jsonb)
               on conflict (day, drink_id, channel) do update set count = excluded.count, query = excluded.query, raw = excluded.raw`;
    }
  });
  console.log(`인스타그램 ${rows.length}종 저장 (${day}). 다음 00:00 크론 때 순위에 반영됩니다. 바로 반영하려면 /api/cron/mentions?channel=insta 호출.`);
} finally {
  await sql.end();
}
