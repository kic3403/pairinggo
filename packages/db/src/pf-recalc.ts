/**
 * 맛 프로필 점수(pairings.profile_score) 한 눈금 재계산 — 카탈로그 전체를 profileFit으로 계산하고 백분위 0~100으로 맞춘다.
 *   pnpm --filter @pairinggo/db pf-recalc [--dry]
 * 왜: 기존 918건은 술마다 늘린 값, 확장분은 다른 식이라 맛 분석 조합이 근거 조합을 앞질렀다(docs/18 §1-1).
 * 끝나면 발행(카탈로그 버전 갱신)까지 하고, 이어서 `pnpm db:export`.
 */
import { calibrateFits, profileFit, type DrinkProfile, type FoodProfile } from "@pairinggo/shared";
import { publishCatalog } from "./catalog-write";
import { connect } from "./sql";

const dry = process.argv.includes("--dry");
const sql = connect();
try {
  const rows = await sql<{ id: number; drink_id: string; food_id: string; dp: DrinkProfile | null; abv: number | null; fp: FoodProfile | null; old: { s?: number } | null }[]>`
    select p.id, p.drink_id, p.food_id, d.profile as dp, d.abv, f.profile as fp, p.profile_score as old
    from pairings p join drinks d on d.id = p.drink_id join foods f on f.id = p.food_id
    where p.status <> 'hidden' order by p.id`;
  const fits = rows.map((r) => (r.dp && r.fp ? profileFit(r.dp, r.abv == null ? null : Number(r.abv), r.fp) : null));
  const calibrated = calibrateFits(fits.map((f) => f?.s ?? 40));
  let changed = 0, missing = 0;
  const updates = rows.map((r, i) => {
    const fit = fits[i];
    if (!fit) { missing++; return null; }
    const pf = { s: calibrated[i], plus: fit.plus, minus: fit.minus };
    if ((r.old?.s ?? -1) !== pf.s) changed++;
    return { id: r.id, pf };
  });
  const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };
  console.log(`대상 ${rows.length} · 프로필 없음 ${missing} · 값 바뀜 ${changed} · 새 pf.s 분포 q25/50/75 ${[0.25, 0.5, 0.75].map((p) => q(calibrated, p)).join("/")}`);
  if (!dry) {
    await sql.begin(async (tx) => {
      for (const u of updates) if (u) await tx`update pairings set profile_score = ${tx.json(u.pf)}, updated_at = now() where id = ${u.id}`;
    });
    await publishCatalog(sql, "맛 프로필 점수 한 눈금 재계산(profileFit 백분위)");
  } else console.log("저장 안 함 (--dry)");
} finally {
  await sql.end();
}
