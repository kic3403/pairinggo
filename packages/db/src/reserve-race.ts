/**
 * 동시 예약 시험 — 정원 3팀인 시험 매장의 같은 슬롯에 20건을 동시에 넣어 정확히 3건만 확정되는지 본다(0023 reserve()의 잠금 확인).
 * 이어서 운영자 취소로 자리가 나면 한 건 더 들어가는지, 남의 예약을 손님으로 취소하면 막히는지, 슬롯 집계 함수가 맞는지 본다.
 * 시험 매장·예약은 끝나면 지운다(성공·실패와 관계없이).
 *   pnpm --filter @pairinggo/db reserve-race
 */
import "dotenv/config";
import postgres from "postgres";
import { addDays, kstParts } from "@pairinggo/shared";

const url = process.env.DATABASE_URL;
if (!url) { console.error("[db] DATABASE_URL이 없습니다(packages/db/.env)."); process.exit(2); }
const N = 20, CAP = 3, TIME = "19:00";
// Supabase 세션 풀 한도(15) 아래로 연결 10개 — 요청 20건은 이 연결들로 동시에 들어간다
const sql = postgres(url, { ssl: "require", max: 10, prepare: false, onnotice: () => {} });

type Res = { ok: boolean; error?: string; id?: string; code?: string };
const reserve = (merchant: string, date: string, i: number) =>
  sql<{ r: Res }[]>`select reserve(${merchant}::uuid, null, ${date}::date, ${TIME}, 2, false, false, null, null, '', ${"시험" + i}, '01000000000') as r`.then((x) => x[0].r);

let merchant = "";
/** 시험 매장(이전 실패분 포함)을 예약 → 매장 순으로 지운다(설정·이력은 cascade) */
async function cleanup() {
  await sql`delete from reservations where merchant_id in (select id from merchants where kakao_place_id like 'race-test-%')`;
  await sql`delete from merchants where kakao_place_id like 'race-test-%'`;
}
let failed = false;
const check = (label: string, ok: boolean, detail = "") => { console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`); if (!ok) failed = true; };

try {
  await cleanup();
  const date = addDays(kstParts(new Date()).date, 1);
  const [m] = await sql<{ id: string }[]>`
    insert into merchants (kakao_place_id, name, owner_name, biz_no, status) values (${"race-test-" + Date.now()}, '동시 예약 시험 매장', '시험', '0000000000', 'approved') returning id`;
  merchant = m.id;
  await sql`insert into reservation_settings (merchant_id, accepting, capacity_parties, capacity_people, min_party, max_party) values (${merchant}, true, ${CAP}, 0, 1, 8)`;
  console.log(`시험 매장 ${merchant} · ${date} ${TIME} · 정원 ${CAP}팀 · 동시 ${N}건`);

  const settled = await Promise.allSettled(Array.from({ length: N }, (_, i) => reserve(merchant, date, i)));
  const thrown = settled.filter((x) => x.status === "rejected").map((x) => String((x as PromiseRejectedResult).reason));
  check("연결 오류 없음", thrown.length === 0, thrown[0] ?? "");
  const results = settled.flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));
  const ok = results.filter((r) => r.ok);
  const errors = results.filter((r) => !r.ok).map((r) => r.error);
  check(`동시 ${N}건 중 확정 ${CAP}건`, ok.length === CAP, `확정 ${ok.length}건, 거절 ${errors.length}건(${[...new Set(errors)].join(",")})`);
  check("거절 사유는 모두 full", errors.every((e) => e === "full"));
  const codes = new Set(ok.map((r) => r.code));
  check("예약번호 6자리·겹침 없음", codes.size === ok.length && ok.every((r) => /^[A-Z0-9]{6}$/.test(r.code ?? "")));

  const [booked] = await sql<{ parties: number; people: number }[]>`select parties, people from reservation_booked(${merchant}::uuid, ${date}::date) where visit_time = ${TIME}`;
  check("슬롯 집계 = 3팀 6명", booked?.parties === CAP && booked?.people === CAP * 2, JSON.stringify(booked));

  const first = ok[0].id!;
  const [byStranger] = await sql<{ r: Res }[]>`select reservation_transition(${first}::uuid, 'cancelled_by_user', 'user', ${"00000000-0000-0000-0000-000000000000"}, '') as r`;
  check("남의 예약을 손님으로 취소 → 막힘", byStranger.r.ok === false && byStranger.r.error === "forbidden", JSON.stringify(byStranger.r));
  const [noReason] = await sql<{ r: Res }[]>`select reservation_transition(${first}::uuid, 'cancelled_by_store', 'admin', 'race-test', '') as r`;
  check("사유 없는 매장 취소 → 막힘", noReason.r.error === "reason_required");
  const [early] = await sql<{ r: Res }[]>`select reservation_transition(${first}::uuid, 'no_show', 'admin', 'race-test', '') as r`;
  check("방문 전 노쇼 → 막힘", early.r.error === "too_early");
  const [cancel] = await sql<{ r: Res }[]>`select reservation_transition(${first}::uuid, 'cancelled_by_user', 'admin', 'race-test', '시험 취소') as r`;
  check("운영자 취소", cancel.r.ok === true);
  const [again] = await sql<{ r: Res }[]>`select reservation_transition(${first}::uuid, 'cancelled_by_store', 'admin', 'race-test', '두 번째') as r`;
  check("취소된 예약은 다시 못 바꿈", again.r.error === "final");

  const refill = await Promise.all(Array.from({ length: 5 }, (_, i) => reserve(merchant, date, 100 + i)));
  check("빈 1자리에 5건 동시 → 1건만", refill.filter((r) => r.ok).length === 1);

  const [events] = await sql<{ n: number }[]>`select count(*)::int as n from reservation_events e join reservations r on r.id = e.reservation_id where r.merchant_id = ${merchant}`;
  check("이력 = 확정 4 + 취소 1", events.n === CAP + 1 + 1, `${events.n}건`);

  const [past] = await sql<{ r: Res }[]>`select reserve(${merchant}::uuid, null, ${addDays(date, -3)}::date, ${TIME}, 2, false, false, null, null, '', '시험', '01000000000') as r`;
  check("지난 시각 → past", past.r.error === "past");
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await cleanup();
  console.log("시험 매장·예약 삭제 완료");
  await sql.end();
}
process.exit(failed ? 1 : 0);
