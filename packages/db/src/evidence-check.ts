/**
 * 근거 링크·인용문 검증 한꺼번에(docs/26 §3-3) — 크론과 같은 본체(packages/server/evidence-check.ts).
 *   pnpm --filter @pairinggo/db evidence-check [--all | --limit N]  (Supabase 키는 apps/web/.env.local에서 읽는다)   → 끝나면 결과 요약. 신뢰도 반영은 웹은 바로(version), 번들은 db:export
 */
import "dotenv/config";
import { checkEvidenceBatch } from "../../server/src/evidence-check";

const all = process.argv.includes("--all");
const i = process.argv.indexOf("--limit");
const r = await checkEvidenceBatch({ all, limit: i >= 0 ? Number(process.argv[i + 1]) : 100, conc: 10 });
console.log(`확인 ${r.checked} — ${Object.entries(r.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ")} · 무게가 바뀐 줄 ${r.factorChanged}`);
for (const s of r.samples) console.log(`  [${s.status}] ${s.note} — ${s.url}`);
