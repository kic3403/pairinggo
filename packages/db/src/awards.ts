/**
 * 식당 수상 표 갱신 — research/michelin-YYYY.json → restaurant_awards (그 가이드·연도 행을 통째로 교체) + award_editions(명단 범위)
 *   pnpm --filter @pairinggo/db awards research/michelin-2026.json [--dry]
 * 파일 형식: { guide, year, edition, published, coverage, source, items: [{ name, city, kind: star|bib|green|selected, level, lat?, lng?, url?, cuisine?, price? }] }
 * 좌표가 없는 행(예전 연도)은 이름이 완전히 같을 때만 대조된다. 매년 절차는 docs/17_미쉐린_배지_연간_갱신.md
 */
import { readFileSync } from "node:fs";
import { normalizePlaceName } from "@pairinggo/shared";
import { connect } from "./sql";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file) { console.error("사용법: pnpm --filter @pairinggo/db awards <파일.json> [--dry]"); process.exit(2); }

type Item = { name: string; city: string; kind: "star" | "bib" | "green" | "selected"; level?: number; lat?: number | null; lng?: number | null; url?: string | null; cuisine?: string | null; price?: string | null };
const j = JSON.parse(readFileSync(file, "utf8")) as { guide: string; year: number; edition?: string; published?: string; coverage?: string; source?: string; items: Item[] };
if (!j.guide || !j.year || !Array.isArray(j.items)) { console.error("형식 오류: guide, year, items 필요"); process.exit(1); }

const rows = j.items.map((it) => ({
  guide: j.guide, year: j.year, city: it.city, name: it.name.trim(), name_norm: normalizePlaceName(it.name),
  kind: it.kind, level: it.kind === "star" ? Math.max(1, Math.min(3, it.level ?? 1)) : 0,
  lat: it.lat ?? null, lng: it.lng ?? null, url: it.url ?? null, cuisine: it.cuisine ?? null, price: it.price ?? null,
}));
const bad = rows.filter((r) => !r.name_norm || !["star", "bib", "green", "selected"].includes(r.kind) || !["서울", "부산"].includes(r.city));
if (bad.length) { console.error("잘못된 행:", bad.map((b) => b.name).join(", ")); process.exit(1); }
const summary = rows.reduce((m, r) => { const k = `${r.city} ${r.kind}${r.kind === "star" ? r.level : ""}`; m[k] = (m[k] || 0) + 1; return m; }, {} as Record<string, number>);
console.log(`${j.guide} ${j.year}: ${rows.length}행`, JSON.stringify(summary), j.coverage ? `· 범위: ${j.coverage}` : "");
if (dry) process.exit(0);

const sql = connect();
try {
  await sql.begin(async (tx) => {
    await tx`delete from restaurant_awards where guide = ${j.guide} and year = ${j.year}`;
    for (const r of rows) await tx`insert into restaurant_awards ${tx(r)}`;
    await tx`insert into award_editions (guide, year, edition, published, coverage, source, updated_at)
             values (${j.guide}, ${j.year}, ${j.edition ?? null}, ${j.published ?? null}, ${j.coverage ?? null}, ${j.source ?? null}, now())
             on conflict (guide, year) do update set edition = excluded.edition, published = excluded.published, coverage = excluded.coverage, source = excluded.source, updated_at = now()`;
  });
  console.log(`저장 완료 — restaurant_awards ${j.guide} ${j.year} 교체. 화면은 1시간 캐시 뒤(또는 재배포) 반영.`);
} finally {
  await sql.end();
}
