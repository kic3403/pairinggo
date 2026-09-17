/**
 * 맛 분석 점수(pairings.profile_score) 재계산 — 근거 조합에서 배운 친화도(shared/pairing/affinity.ts)로 매기고,
 * 카탈로그의 모든 술 × 음식 조합을 기준으로 0~100 백분위에 놓는다.
 *   pnpm --filter @pairinggo/db pf-recalc [--dry]
 * 왜(2026-09-17): 예전 점수(profileFit 규칙)는 실제 근거 조합을 무작위 수준(AUC 0.50)으로밖에 못 골랐다. 친화도는 교차검증 0.60.
 *   카드 문구(plus/minus)는 profileFit 문구를 그대로 두고, 뚜렷한 친화도가 있으면 맨 앞에 한 줄 붙인다.
 * 근거 조합이 늘어난 뒤 다시 돌리면 점수도 따라 좋아진다. 끝나면 발행(카탈로그 버전 갱신)까지 하고, 이어서 `pnpm db:export`.
 */
import { affinityNotes, affinityRaw, affinityScale, buildAffinity, crossValidatedAuc, profileFit, type DrinkProfile, type FoodProfile } from "@pairinggo/shared";
import { publishCatalog } from "./catalog-write";
import { connect } from "./sql";

const dry = process.argv.includes("--dry");
const sql = connect();
try {
  const drinks = await sql<{ id: string; name: string; category: string; abv: number | null; profile: DrinkProfile | null }[]>`select id, name, category, abv, profile from drinks order by id`;
  const foods = await sql<{ id: string; name: string; category: string; profile: FoodProfile | null }[]>`select id, name, category, profile from foods order by id`;
  const rows = await sql<{ id: number; d: string; f: string; src: string | null; status: string; old: { s?: number } | null }[]>`
    select id, drink_id as d, food_id as f, source_tier as src, status, profile_score as old from pairings where status <> 'hidden' order by id`;
  const D = new Map(drinks.map((d) => [d.id, d])), F = new Map(foods.map((f) => [f.id, { ...f, profile: f.profile ?? undefined }]));
  // 친화도는 앱에 보이는 근거 조합(curated)으로만 배운다 — 검수 중(pending)인 조합은 아직 근거로 치지 않는다
  const model = buildAffinity({ drinks, foods: [...F.values()], pairings: rows.filter((r) => r.status === "curated") });
  const scale = affinityScale(model, drinks, [...F.values()]);

  let changed = 0, missing = 0;
  const updates = rows.map((r) => {
    const d = D.get(r.d), f = F.get(r.f);
    if (!d?.profile || !f?.profile) { missing++; return null; }
    const rule = profileFit(d.profile, d.abv == null ? null : Number(d.abv), f.profile);
    const notes = affinityNotes(model, d, f);
    const pf = { s: scale(affinityRaw(model, d, f)), plus: [...notes.plus, ...rule.plus], minus: [...notes.minus, ...rule.minus] };
    if ((r.old?.s ?? -1) !== pf.s) changed++;
    return { id: r.id, pf, r };
  });

  const ok = updates.filter((u): u is NonNullable<typeof u> => !!u);
  const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };
  const evid = ok.filter((u) => model.evidence.has(`${u.r.d}|${u.r.f}`)), est = ok.filter((u) => !model.evidence.has(`${u.r.d}|${u.r.f}`));
  console.log(`근거 조합 ${model.n}건으로 학습 · 대상 ${rows.length} · 프로필 없음 ${missing} · 값 바뀜 ${changed}`);
  console.log(`새 점수 중앙값 — 근거 조합 ${q(evid.map((u) => u.pf.s), 0.5)} · 맛 분석 조합 ${q(est.map((u) => u.pf.s), 0.5)} (50 = 모든 술×음식 조합의 한가운데)`);
  const pos = evid.map((u) => ({ d: u.r.d, f: u.r.f }));
  const cv = crossValidatedAuc(pos, (train) => { const m = buildAffinity({ drinks, foods: [...F.values()], pairings: train.map((p) => ({ ...p, src: "media" })) }); return (d, f) => affinityRaw(m, D.get(d)!, F.get(f)!); });
  const cvRule = crossValidatedAuc(pos, () => (d, f) => profileFit(D.get(d)!.profile!, D.get(d)!.abv == null ? null : Number(D.get(d)!.abv), F.get(f)!.profile!).s);
  console.log(`검증(AUC, 0.5=무작위) — 새 점수 ${cv.toFixed(3)} · 예전 규칙 ${cvRule.toFixed(3)}`);
  if (dry) {
    const name = (u: (typeof ok)[number]) => `${D.get(u.r.d)!.name} × ${F.get(u.r.f)!.name}`;
    const moved = est.map((u) => ({ u, diff: u.pf.s - (u.r.old?.s ?? 50) })).sort((a, b) => b.diff - a.diff);
    console.log("\n맛 분석 조합 중 가장 많이 오른 10개"); for (const { u, diff } of moved.slice(0, 10)) console.log(`  +${diff} → ${u.pf.s}  ${name(u)}  ${u.pf.plus[0] ?? ""}`);
    console.log("맛 분석 조합 중 가장 많이 내린 10개"); for (const { u, diff } of moved.slice(-10).reverse()) console.log(`  ${diff} → ${u.pf.s}  ${name(u)}  ${u.pf.minus[0] ?? ""}`);
    console.log("\n저장 안 함 (--dry)");
  } else {
    await sql.begin(async (tx) => {
      for (const u of ok) await tx`update pairings set profile_score = ${tx.json(u.pf)}, updated_at = now() where id = ${u.id}`;
    });
    await publishCatalog(sql, "맛 분석 점수 재계산(근거에서 배운 친화도)");
  }
} finally {
  await sql.end();
}
