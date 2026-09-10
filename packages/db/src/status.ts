/**
 * DB 상태 한눈에 — 카탈로그 버전·행 수·로그 수·RLS·적용된 마이그레이션
 *   pnpm db:status
 */
import { connect } from "./sql";

const sql = connect();
try {
  const [c] = await sql<Record<string, number | string>[]>`select
    (select count(*)::int from drinks) drinks, (select count(*)::int from foods) foods, (select count(*)::int from pairings) pairings,
    (select count(*)::int from pairing_evidence) evidence, (select count(*)::int from pairing_candidates) candidates,
    (select count(*)::int from events) events, (select count(*)::int from search_logs) search_logs,
    (select count(*)::int from popular_terms) popular_terms, (select count(*)::int from pairing_feedback) feedback,
    (select count(*)::int from catalog_snapshots) snapshots,
    (select value #>> '{}' from catalog_meta where key = 'version') version`;
  console.log("카탈로그  ", `버전 ${c.version} · 술 ${c.drinks} · 음식 ${c.foods} · 페어링 ${c.pairings} · 근거 ${c.evidence} · 후보 ${c.candidates} · 스냅샷 ${c.snapshots}`);
  console.log("로그      ", `이벤트 ${c.events} · 검색로그 ${c.search_logs} · 인기검색어 ${c.popular_terms} · 페어링피드백 ${c.feedback}`);
  const mig = await sql<{ name: string }[]>`select name from schema_migrations order by name`;
  console.log("마이그레이션", mig.map((m) => m.name).join(", "));
  const rls = await sql<{ tablename: string; rowsecurity: boolean }[]>`select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations' order by tablename`;
  const off = rls.filter((t) => !t.rowsecurity).map((t) => t.tablename);
  console.log("RLS       ", off.length ? `꺼진 테이블: ${off.join(", ")}` : `전체 ${rls.length}개 테이블 켜짐`);
  const top = await sql<{ term: string; type: string; count: number }[]>`select term, type, count from popular_terms order by count desc limit 5`;
  if (top.length) console.log("인기 상위 ", top.map((t) => `${t.term}(${t.type} ${t.count})`).join(" · "));
} finally {
  await sql.end();
}
