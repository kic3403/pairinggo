/**
 * 발행 롤백 — catalog_snapshots에 저장된 이전 버전으로 페어링 상태·점수를 되돌린다.
 *   pnpm db:rollback                       스냅샷(발행 이력) 목록
 *   pnpm db:rollback <version>             무엇이 바뀌는지만 보여줌 (기본: 미적용)
 *   pnpm db:rollback <version> --apply     실제로 적용 + 새 버전 발행
 *
 * 되돌리는 방식: 페어링을 지우지 않는다. 스냅샷 이후 추가된 것은 pending으로 내려 카탈로그에서만 빼고
 * (근거·검수 이력은 그대로 보존), 점수·이유·등급이 달라진 것은 스냅샷 값으로 복원한다.
 * 적용 후에는 새 버전을 발행해야 미니앱이 바뀐 카탈로그를 받아 간다.
 */
import { connect } from "./sql";

type SnapPairing = { d: string; f: string; es: number; reason?: string; src?: string };
type Snapshot = { version: string; counts: Record<string, number>; note: string | null; created_at: string; data: { pairings: SnapPairing[] } };
type Current = { id: number; drink_id: string; food_id: string; expert_score: number; reason: string | null; source_tier: string; status: string };

export type Plan = {
  demote: Current[];                                          // 스냅샷에 없음 → pending
  restore: { cur: Current; to: SnapPairing }[];               // 값이 달라짐 → 스냅샷 값으로
  revive: { cur: Current; to: SnapPairing }[];                // 스냅샷엔 있는데 지금 카탈로그 밖 → curated
  missing: SnapPairing[];                                     // 스냅샷에 있으나 행 자체가 없음 (수동 확인)
};

const key = (d: string, f: string) => `${d}|${f}`;
const IN_CATALOG = ["curated", "ai"];

/** 순수 함수 — 스냅샷과 현재 상태를 비교해 변경 계획을 만든다 */
export function buildPlan(snapPairings: SnapPairing[], current: Current[]): Plan {
  const snap = new Map(snapPairings.map((p) => [key(p.d, p.f), p]));
  const cur = new Map(current.map((c) => [key(c.drink_id, c.food_id), c]));
  const plan: Plan = { demote: [], restore: [], revive: [], missing: [] };
  for (const c of current) {
    const s = snap.get(key(c.drink_id, c.food_id));
    if (!s) { if (IN_CATALOG.includes(c.status)) plan.demote.push(c); continue; }
    if (!IN_CATALOG.includes(c.status)) { plan.revive.push({ cur: c, to: s }); continue; }
    const changed = Number(c.expert_score) !== Number(s.es) || (c.reason || "") !== (s.reason || "") || c.source_tier !== (s.src || "profile");
    if (changed) plan.restore.push({ cur: c, to: s });
  }
  for (const [k, s] of snap) if (!cur.has(k)) plan.missing.push(s);
  return plan;
}

/* ---------------- 실행 ---------------- */
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const version = args.find((a) => !a.startsWith("--"));
const sql = connect();

try {
  const snaps = await sql<{ version: string; counts: Record<string, number>; note: string | null; created_at: Date }[]>`
    select version, counts, note, created_at from catalog_snapshots order by created_at desc limit 20`;
  const live = (await sql<{ v: string }[]>`select value #>> '{}' v from catalog_meta where key = 'version'`)[0]?.v;

  if (!version) {
    console.log("발행 이력 (최근 20건) — 현재 카탈로그 버전:", live, "\n");
    for (const s of snaps) {
      const c = s.counts || {};
      console.log(`${s.version === live ? "▶" : " "} ${s.version}  술 ${c.drinks ?? "?"} · 음식 ${c.foods ?? "?"} · 페어링 ${c.pairings ?? "?"}  ${s.note || ""}`);
    }
    console.log("\n되돌리려면: pnpm db:rollback <version>        (무엇이 바뀌는지만 보여줌)");
    console.log("실제 적용:   pnpm db:rollback <version> --apply");
    process.exit(0);
  }

  const [snap] = await sql<Snapshot[]>`select version, counts, note, created_at, data from catalog_snapshots where version = ${version}`;
  if (!snap) { console.error(`스냅샷을 찾을 수 없습니다: ${version}\n목록은 인자 없이 실행하세요.`); process.exit(2); }
  if (snap.version === live) console.warn("주의: 되돌릴 대상이 현재 버전과 같습니다. 변경이 없을 수 있습니다.\n");

  const current = await sql<Current[]>`select id, drink_id, food_id, expert_score, reason, source_tier, status from pairings`;
  const plan = buildPlan(snap.data?.pairings || [], current);

  console.log(`대상 스냅샷 ${snap.version} (${new Date(snap.created_at).toLocaleString("ko-KR")})${snap.note ? ` · ${snap.note}` : ""}`);
  console.log(`스냅샷 페어링 ${snap.data?.pairings?.length ?? 0}건 · 현재 페어링 ${current.length}건 (카탈로그 노출 ${current.filter((c) => IN_CATALOG.includes(c.status)).length}건)\n`);
  console.log(`되돌릴 내용`);
  console.log(`  카탈로그에서 내림(pending)  ${plan.demote.length}건 — 스냅샷 이후 추가된 페어링. 근거는 보존`);
  console.log(`  점수·이유·등급 복원          ${plan.restore.length}건`);
  console.log(`  다시 게시(curated)          ${plan.revive.length}건 — 스냅샷 이후 내려간 페어링`);
  if (plan.missing.length) console.log(`  행이 없어 복구 불가          ${plan.missing.length}건 — 수동 확인 필요`);

  const sample = <T,>(a: T[], n = 5) => a.slice(0, n);
  const cut = (s: string, n = 34) => (s.length > n ? s.slice(0, n) + "…" : s);
  /** 바뀌는 필드만 골라 "지금 → 되돌린 뒤"로 보여준다 */
  const diff = (cur: Current, to: SnapPairing) => {
    const d: string[] = [];
    if (Number(cur.expert_score) !== Number(to.es)) d.push(`점수 ${cur.expert_score} → ${to.es}`);
    if (cur.source_tier !== (to.src || "profile")) d.push(`등급 ${cur.source_tier} → ${to.src || "profile"}`);
    if ((cur.reason || "") !== (to.reason || "")) d.push(`이유 "${cut(cur.reason || "")}" → "${cut(to.reason || "")}"`);
    return d.join(" · ");
  };
  for (const c of sample(plan.demote)) console.log(`    - 내림 ${c.drink_id} × ${c.food_id} (${c.source_tier} ${c.expert_score}) "${cut(c.reason || "")}"`);
  for (const r of sample(plan.restore)) console.log(`    - 복원 ${r.cur.drink_id} × ${r.cur.food_id}: ${diff(r.cur, r.to)}`);
  for (const r of sample(plan.revive)) console.log(`    - 게시 ${r.cur.drink_id} × ${r.cur.food_id} (현재 ${r.cur.status}) ${diff(r.cur, r.to) || "값 변경 없음"}`);
  for (const a of [plan.demote, plan.restore, plan.revive]) if (a.length > 5) console.log(`      … 외 ${a.length - 5}건`);

  const total = plan.demote.length + plan.restore.length + plan.revive.length;
  if (!total) { console.log("\n바뀔 것이 없습니다."); process.exit(0); }

  if (!apply) { console.log(`\n총 ${total}건이 바뀝니다. 실제로 적용하려면 --apply 를 붙여 다시 실행하세요.`); process.exit(0); }

  const newVersion = new Date().toISOString();
  await sql.begin(async (tx) => {
    for (const c of plan.demote) await tx`update pairings set status = 'pending', updated_at = now() where id = ${c.id}`;
    for (const { cur, to } of plan.restore) await tx`update pairings set expert_score = ${to.es}, reason = ${to.reason || ""}, source_tier = ${to.src || "profile"}, updated_at = now() where id = ${cur.id}`;
    for (const { cur, to } of plan.revive) await tx`update pairings set status = 'curated', expert_score = ${to.es}, reason = ${to.reason || ""}, source_tier = ${to.src || "profile"}, updated_at = now() where id = ${cur.id}`;
    // 되돌린 상태를 새 버전으로 발행 (스냅샷 먼저 → 버전 나중)
    await tx`insert into catalog_snapshots (version, counts, data, note) values (${newVersion}, ${sql.json(snap.counts)}, ${sql.json(snap.data)}, ${`롤백 → ${snap.version} (내림 ${plan.demote.length}·복원 ${plan.restore.length}·게시 ${plan.revive.length})`})`;
    await tx`insert into catalog_meta (key, value, updated_at) values ('counts', ${sql.json(snap.counts)}, ${newVersion}) on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`;
    await tx`insert into catalog_meta (key, value, updated_at) values ('version', ${sql.json(newVersion)}, ${newVersion}) on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`;
  });
  console.log(`\n적용 완료 — 새 버전 ${newVersion} (내용은 ${snap.version} 시점). 미니앱은 다음 시작 때 받아 갑니다.`);
  console.log("어드민 발행 화면에서 버전이 바뀐 것을 확인하세요.");
} finally {
  await sql.end();
}
