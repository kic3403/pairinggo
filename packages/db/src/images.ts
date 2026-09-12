/**
 * 술 사진 등록 — 양조장이 제공(허락)한 사진 주소를 drinks.image_url / image_credit 에 넣는다.
 *   pnpm --filter @pairinggo/db images <파일.csv> [--dry]
 * CSV(첫 줄 머리글): 술이름(또는 ID·별칭), 이미지URL, 출처표기(예: "복순도가 제공"), 허락근거(메일 날짜·담당자 — DB엔 안 넣고 기록용)
 * 예)
 *   술이름,이미지URL,출처표기,허락근거
 *   복순도가 손막걸리,https://cdn.example.com/boksoon.jpg,복순도가 제공,2026-09-15 메일 김OO
 * 규칙(docs/16): 더술닷컴(aT)·타 사이트 사진은 넣지 않는다. 사진은 우리 저장소(Supabase Storage 등)에 올린 주소를 쓴다 — 양조장 사이트 주소를 직접 걸면 그쪽이 바꾸는 순간 깨진다.
 * 넣은 뒤 홈 배너·목록 타일이 사진으로 바뀌려면 카탈로그 캐시(5분) 또는 어드민 발행을 기다린다.
 */
import { readFileSync } from "node:fs";
import { DATA } from "@pairinggo/shared";
import { connect } from "./sql";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file) { console.error("사용법: pnpm --filter @pairinggo/db images <파일.csv> [--dry]"); process.exit(2); }

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const byKey = new Map<string, string>();
for (const d of DATA.drinks) { byKey.set(norm(d.id), d.id); byKey.set(norm(d.name), d.id); if (d.alias) byKey.set(norm(d.alias), d.id); }

const lines = readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const rows: { id: string; name: string; url: string; credit: string }[] = [];
const bad: string[] = [];
for (const line of lines.slice(1)) {
  const cols = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const [name, url, credit] = cols;
  const id = byKey.get(norm(name || ""));
  if (!id) { bad.push(`${name}: 이름 못 찾음`); continue; }
  if (!/^https:\/\/\S+\.(jpe?g|png|webp|avif)(\?\S*)?$/i.test(url || "")) { bad.push(`${name}: 이미지 주소가 아님(${url})`); continue; }
  if (/thesool\.com|aT|agro\.go\.kr/i.test(url || "")) { bad.push(`${name}: 더술닷컴(aT) 사진은 상업 이용 금지`); continue; }
  if (!credit) { bad.push(`${name}: 출처표기 비어 있음`); continue; }
  rows.push({ id, name: DATA.drinks.find((d) => d.id === id)!.name, url, credit });
}
if (bad.length) console.warn(`건너뜀 ${bad.length}:\n  ${bad.join("\n  ")}`);
if (!rows.length) { console.error("넣을 행이 없습니다."); process.exit(1); }
for (const r of rows) console.log(`${dry ? "(dry) " : ""}${r.name} ← ${r.url} (${r.credit})`);
if (dry) process.exit(0);

const sql = connect();
try {
  await sql.begin(async (tx) => {
    for (const r of rows) await tx`update drinks set image_url = ${r.url}, image_credit = ${r.credit}, updated_at = now() where id = ${r.id}`;
  });
  console.log(`사진 ${rows.length}종 저장. 홈 배너·목록은 카탈로그 캐시(5분) 뒤 또는 어드민 발행 후 바뀝니다.`);
} finally {
  await sql.end();
}
