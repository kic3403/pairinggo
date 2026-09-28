/**
 * 전문가 페어링 판정(2026-09-28, docs/27) — expert_reviews(0045)가 원본, pairings·pairing_evidence에 동기화한다(partner-pairings.ts와 같은 구조).
 *  - 어울림(yes): pairings 행이 없으면 sommelier 93으로 새로 만들고(created), 있으면 스냅샷(prev)을 남기고 applyExpertReview 값으로 올린다. 근거 줄은 전문가당 하나(evidence_id).
 *  - 보통·아님: 근거를 만들지 않고 행이 있을 때만 pairing_id를 잇는다(집계용). '아님'만으로 카드가 생기지 않는다.
 *  - 판정을 고치면 먼저 이전 yes를 되돌리고(근거 삭제·행 복원) 새 판정을 적용한다 — "삭제 + 저장"과 같은 경로.
 *  - 되돌리기 안전 규칙: created 행은 다른 근거가 0개일 때만 삭제, prev 복원은 현재 tier가 sommelier일 때만(그 뒤 파트너가 official로 올렸으면 손대지 않음).
 *  - 저장·삭제·정지·재개 뒤 pairings.expert_yes/expert_no를 다시 세고(승인 전문가만) catalog_meta.version을 올린다.
 */
import { EXPERT_REVIEWS_PER_DAY, applyExpertReview, cleanExpertNote, expertEvidence, expertReviewProblem, profileFit, type DrinkProfile, type ExpertVerdict, type FoodProfile, type PairingSnapshot } from "@pairinggo/shared";
import { db } from "./db";

const need = () => { const c = db(); if (!c) throw new Error("DB 미설정"); return c; };
type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");
const now = () => new Date().toISOString();

export type ExpertReviewItem = { id: number; drinkId: string; drinkName: string; foodId: string; foodName: string; verdict: ExpertVerdict; note: string; updatedAt: string };
const SELECT = "*,drinks!expert_reviews_drink_id_fkey(name),foods!expert_reviews_food_id_fkey(name)";
const toItem = (r: Row): ExpertReviewItem => ({
  id: Number(r.id), drinkId: str(r.drink_id), drinkName: str((r.drinks as Row | null)?.name || r.drink_id), foodId: str(r.food_id), foodName: str((r.foods as Row | null)?.name || r.food_id),
  verdict: r.verdict as ExpertVerdict, note: str(r.note), updatedAt: str(r.updated_at),
});

export async function bumpCatalogVersion() {
  const v = now();
  await need().from("catalog_meta").upsert({ key: "version", value: v, updated_at: v });
}

export async function listExpertReviews(userId: string): Promise<ExpertReviewItem[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("expert_reviews").select(SELECT).eq("user_id", userId).order("updated_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toItem);
}

/** 이 조합의 승인 전문가 판정 수 → pairings.expert_yes/no(행이 있을 때만) */
export async function recountExpert(drinkId: string, foodId: string): Promise<{ yes: number; no: number }> {
  const c = need();
  // expert_reviews와 experts는 둘 다 users를 가리킬 뿐 서로 FK가 없어 조인 필터가 안 된다 — 두 번 읽는다
  const { data: rows, error } = await c.from("expert_reviews").select("user_id,verdict").eq("drink_id", drinkId).eq("food_id", foodId);
  if (error) throw new Error(error.message);
  const ids = [...new Set((rows ?? []).map((r) => String(r.user_id)))];
  const approved = new Set<string>();
  if (ids.length) { const { data: ex } = await c.from("experts").select("user_id").in("user_id", ids).eq("status", "approved"); for (const e of ex ?? []) approved.add(String(e.user_id)); }
  const live = (rows ?? []).filter((r) => approved.has(String(r.user_id)));
  const counts = { yes: live.filter((r) => r.verdict === "yes").length, no: live.filter((r) => r.verdict === "no").length };
  await c.from("pairings").update({ expert_yes: counts.yes, expert_no: counts.no }).eq("drink_id", drinkId).eq("food_id", foodId);
  return counts;
}

/** 전문가 한 사람의 판정이 걸린 조합 전부 다시 세기 — 승인·정지·재개 때 */
export async function recountExpertFor(userId: string): Promise<number> {
  const c = need();
  const { data } = await c.from("expert_reviews").select("drink_id,food_id").eq("user_id", userId);
  for (const r of (data ?? []) as { drink_id: string; food_id: string }[]) await recountExpert(r.drink_id, r.food_id);
  if (data?.length) await bumpCatalogVersion();
  return data?.length ?? 0;
}

async function refreshReviewsCount(c: ReturnType<typeof need>, userId: string) {
  const { count } = await c.from("expert_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId);
  await c.from("experts").update({ reviews_count: count ?? 0, updated_at: now() }).eq("user_id", userId);
}

/** 이전 yes 판정 되돌리기 — 근거 줄 삭제 → 우리가 만든 행은 다른 근거가 없을 때만 삭제, 아니면 prev 복원(현재 sommelier일 때만) */
async function revertYes(c: ReturnType<typeof need>, r: Row) {
  if (r.evidence_id) await c.from("pairing_evidence").delete().eq("id", r.evidence_id);
  if (!r.pairing_id) return;
  const { data: p } = await c.from("pairings").select("id,source_tier").eq("id", r.pairing_id).maybeSingle();
  if (!p) return;
  const { count } = await c.from("pairing_evidence").select("id", { count: "exact", head: true }).eq("pairing_id", r.pairing_id);
  if (r.created && (count ?? 0) === 0) { await c.from("pairings").delete().eq("id", r.pairing_id); return; }
  const prev = r.prev as PairingSnapshot | null;
  if (prev && str(p.source_tier) === "sommelier") await c.from("pairings").update({ source_tier: prev.tier, expert_score: prev.es, reason: prev.reason, updated_at: now() }).eq("id", r.pairing_id);
}

export async function saveExpertReview(expert: { userId: string; displayName: string }, raw: { drinkId?: unknown; foodId?: unknown; verdict?: unknown; note?: unknown }): Promise<ExpertReviewItem> {
  const c = need();
  const drinkId = str(raw.drinkId).trim(), foodId = str(raw.foodId).trim(), verdict = str(raw.verdict) as ExpertVerdict;
  const note = cleanExpertNote(raw.note);
  const problem = expertReviewProblem({ drinkId, foodId, verdict, note });
  if (problem) throw new Error(problem);
  const { data: existing } = await c.from("expert_reviews").select("*").eq("user_id", expert.userId).eq("drink_id", drinkId).eq("food_id", foodId).maybeSingle();
  if (!existing) {
    const { count } = await c.from("expert_reviews").select("id", { count: "exact", head: true }).eq("user_id", expert.userId).gte("created_at", new Date(Date.now() - 86400_000).toISOString());
    if ((count ?? 0) >= EXPERT_REVIEWS_PER_DAY) throw new Error(`판정은 하루 ${EXPERT_REVIEWS_PER_DAY}개까지예요 — 내일 이어서 해 주세요.`);
  }
  const [{ data: drink }, { data: food }] = await Promise.all([
    c.from("drinks").select("id,name,abv,profile,is_demo").eq("id", drinkId).maybeSingle(),
    c.from("foods").select("id,name,profile").eq("id", foodId).maybeSingle(),
  ]);
  if (!drink || drink.is_demo) throw new Error("카탈로그에 있는 술을 골라 주세요.");
  if (!food) throw new Error("카탈로그에 있는 음식을 골라 주세요.");

  // 이전 판정이 yes였으면 먼저 되돌린다(고치기 = 삭제 + 저장)
  if (existing?.verdict === "yes") await revertYes(c, existing as Row);

  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const { data: pairing } = await c.from("pairings").select("id,source_tier,expert_score,reason").eq("drink_id", drinkId).eq("food_id", foodId).maybeSingle();
  let pairingId: number | null = pairing ? Number(pairing.id) : null, evidenceId: number | null = null, created = false, prev: PairingSnapshot | null = null;
  if (verdict === "yes") {
    if (pairing) {
      prev = { tier: str(pairing.source_tier), es: Number(pairing.expert_score), reason: str(pairing.reason) };
      const next = applyExpertReview(prev, note, expert.displayName);
      const u = await c.from("pairings").update({ source_tier: next.tier, expert_score: next.es, reason: next.reason, checked_on: today, updated_at: now() }).eq("id", pairing.id);
      if (u.error) throw new Error(u.error.message);
    } else {
      const next = applyExpertReview(null, note, expert.displayName);
      const dp = drink.profile as DrinkProfile | null, fp = food.profile as FoodProfile | null;
      const pf = dp && fp ? profileFit(dp, drink.abv == null ? null : Number(drink.abv), fp) : { s: 40, plus: [], minus: [] };
      const ins = await c.from("pairings").insert({ drink_id: drinkId, food_id: foodId, expert_score: next.es, reason: next.reason, blog_count: 0, source_tier: "sommelier", status: "curated", profile_score: pf, checked_on: today }).select("id").single();
      if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "페어링 생성 실패");
      pairingId = Number(ins.data.id);
      created = true;
    }
    const ev = await c.from("pairing_evidence").insert({ pairing_id: pairingId, ...expertEvidence(expert.displayName, note), captured_at: now() }).select("id").single();
    if (ev.error || !ev.data) throw new Error(ev.error?.message ?? "근거 저장 실패");
    evidenceId = Number(ev.data.id);
  }
  const up = await c.from("expert_reviews").upsert({ user_id: expert.userId, drink_id: drinkId, food_id: foodId, verdict, note, pairing_id: pairingId, evidence_id: evidenceId, created, prev, updated_at: now() }, { onConflict: "user_id,drink_id,food_id" }).select(SELECT).single();
  if (up.error || !up.data) throw new Error(up.error?.message ?? "저장 실패");
  await recountExpert(drinkId, foodId);
  await refreshReviewsCount(c, expert.userId);
  await bumpCatalogVersion();
  return toItem(up.data as unknown as Row);
}

export async function removeExpertReview(userId: string, id: number): Promise<void> {
  const c = need();
  const { data: r } = await c.from("expert_reviews").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!r) throw new Error("없는 판정이에요.");
  if (r.verdict === "yes") await revertYes(c, r as Row);
  const d = await c.from("expert_reviews").delete().eq("id", id);
  if (d.error) throw new Error(d.error.message);
  await recountExpert(str(r.drink_id), str(r.food_id));
  await refreshReviewsCount(c, userId);
  await bumpCatalogVersion();
}

/** 탈퇴 — 판정을 모두 되돌린 뒤(근거·행·집계) 호출한 쪽이 users를 지운다 */
export async function removeAllExpertReviews(userId: string): Promise<number> {
  const c = db();
  if (!c) return 0;
  const { data } = await c.from("expert_reviews").select("id").eq("user_id", userId);
  for (const r of data ?? []) await removeExpertReview(userId, Number(r.id)).catch(() => null);
  return data?.length ?? 0;
}

/** 표시명이 바뀌면(운영자 편집) 그 전문가의 근거 줄 source·who도 바꾼다 */
export async function renameExpertEvidence(oldName: string, newName: string): Promise<void> {
  if (!oldName || oldName === newName) return;
  const c = need();
  const from = expertEvidence(oldName, ""), to = expertEvidence(newName, "");
  await c.from("pairing_evidence").update({ source: to.source, who: to.who }).eq("tier", "sommelier").eq("source", from.source);
}
