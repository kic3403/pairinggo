/**
 * 어드민 데이터 접근 — 후보 목록·대시보드 집계·승격·발행. service_role(db()) 사용.
 */
import { SRC_RANK, type SrcTier } from "@pairinggo/shared";
import { db } from "./db";
import { getCatalog, invalidateCatalog } from "./catalog";

export type CandidateRow = {
  id: number; drink_raw: string | null; food_raw: string | null; drink_id: string | null; food_id: string | null;
  source_name: string | null; url: string | null; quote: string | null; who: string | null;
  suggested_tier: string | null; suggested_score: number | null; suggested_reason: string | null;
  origin: string; source_kind: string | null; query: string | null; mention_count: number; batch: string | null;
  status: string; review_note: string | null; created_at: string;
};

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정 — 어드민은 DB가 필요합니다"); return sb; };

export async function listCandidates(opts: { status?: string; tier?: string; drink?: string; limit?: number } = {}) {
  const sb = need();
  let q = sb.from("pairing_candidates").select("*").order("mention_count", { ascending: false }).order("created_at", { ascending: true }).limit(opts.limit ?? 60);
  q = q.eq("status", opts.status || "draft");
  if (opts.tier) q = q.eq("suggested_tier", opts.tier);
  if (opts.drink) q = q.eq("drink_id", opts.drink);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as CandidateRow[];
}

export async function dashboard() {
  const sb = need();
  const [cands, pairCounts, empties, lastPub] = await Promise.all([
    sb.from("pairing_candidates").select("status"),
    sb.from("pairings").select("drink_id"),
    sb.from("popular_terms").select("term,type,count").eq("type", "empty").order("count", { ascending: false }).limit(20),
    sb.from("catalog_meta").select("value,updated_at").eq("key", "version").maybeSingle(),
  ]);
  const byStatus: Record<string, number> = {};
  for (const c of cands.data || []) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  const perDrink = new Map<string, number>();
  for (const p of pairCounts.data || []) perDrink.set(p.drink_id, (perDrink.get(p.drink_id) || 0) + 1);
  const c = await getCatalog();
  const low = c.dataset.drinks.map((d) => ({ id: d.id, name: d.name, n: perDrink.get(d.id) || 0 })).filter((x) => x.n < 5).sort((a, b) => a.n - b.n);
  const noPair = c.dataset.foods.filter((f) => !c.dataset.pairings.some((p) => p.f === f.id)).map((f) => f.name);
  const promotedAfter = lastPub.data?.updated_at ? (await sb.from("pairing_candidates").select("id", { count: "exact", head: true }).eq("status", "promoted").gt("reviewed_at", lastPub.data.updated_at)).count || 0 : 0;
  return { byStatus, low, noPair, empties: empties.data || [], version: String(lastPub.data?.value ?? "-"), publishedAt: lastPub.data?.updated_at ?? null, promotedAfter, totalPairings: (pairCounts.data || []).length };
}

const TIER_RANK = (t: string) => (SRC_RANK as Record<string, number>)[t] ?? 0;
const TIER_TO_PAIRING = (t: string): SrcTier => (["official", "sommelier", "media", "blog", "profile", "ai"].includes(t) ? (t as SrcTier) : "profile");

/** 승격: 후보 → pairings(+evidence). 규칙: official/sommelier 1개 또는 근거 2개 이상이면 curated, 아니면 pending */
export async function promote(input: { candidateId: number; score: number; tier: string; who: string | null; reason: string; reviewer: string }) {
  const sb = need();
  const { data: c, error: e0 } = await sb.from("pairing_candidates").select("*").eq("id", input.candidateId).single();
  if (e0 || !c) throw new Error("후보를 찾을 수 없어요");
  if (!c.drink_id || !c.food_id) throw new Error("술·음식이 지정되지 않은 후보예요 (엔티티 지정 먼저)");
  const tier = TIER_TO_PAIRING(input.tier);
  const { data: existing } = await sb.from("pairings").select("id,expert_score,source_tier,status").eq("drink_id", c.drink_id).eq("food_id", c.food_id).maybeSingle();
  let pairingId: number;
  let status: string;
  if (!existing) {
    status = ["official", "sommelier"].includes(tier) ? "curated" : "pending";
    const { data: p, error: e1 } = await sb.from("pairings").insert({ drink_id: c.drink_id, food_id: c.food_id, expert_score: input.score, reason: input.reason, blog_count: 0, source_tier: tier, status }).select("id").single();
    if (e1 || !p) throw new Error(e1?.message || "페어링 생성 실패");
    pairingId = p.id;
  } else {
    pairingId = existing.id;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (TIER_RANK(tier) > TIER_RANK(existing.source_tier)) { patch.source_tier = tier; patch.expert_score = Math.max(existing.expert_score, input.score); if (input.reason) patch.reason = input.reason; }
    status = existing.status;
    await sb.from("pairings").update(patch).eq("id", pairingId);
  }
  // 같은 URL의 근거가 이미 있으면 중복 등록하지 않는다 (시드 근거와 수집 결과가 겹치는 경우)
  let duplicated = false;
  if (c.url) { const { count: same } = await sb.from("pairing_evidence").select("id", { count: "exact", head: true }).eq("pairing_id", pairingId).eq("url", c.url); duplicated = (same || 0) > 0; }
  if (!duplicated) {
    const { error: e2 } = await sb.from("pairing_evidence").insert({ pairing_id: pairingId, source: c.source_name, url: c.url, quote: c.quote, who: input.who, tier: input.tier, source_id: c.source_id, captured_at: new Date().toISOString() });
    if (e2) throw new Error(e2.message);
  }
  // 근거 2개 이상이면 curated 승격
  const { count } = await sb.from("pairing_evidence").select("id", { count: "exact", head: true }).eq("pairing_id", pairingId);
  if (status === "pending" && (count || 0) >= 2) { status = "curated"; await sb.from("pairings").update({ status }).eq("id", pairingId); }
  await sb.from("pairing_candidates").update({ status: "promoted", promoted_pairing_id: pairingId, reviewer: input.reviewer, reviewed_at: new Date().toISOString(), suggested_score: input.score, suggested_tier: input.tier, who: input.who, suggested_reason: input.reason, review_note: duplicated ? "같은 URL 근거가 이미 있어 근거는 추가하지 않음" : null }).eq("id", input.candidateId);
  return { pairingId, status, evidence: count || 0, duplicated, created: !existing };
}

export async function reject(candidateId: number, reason: string, reviewer: string) {
  const sb = need();
  const { error } = await sb.from("pairing_candidates").update({ status: "rejected", review_note: reason, reviewer, reviewed_at: new Date().toISOString() }).eq("id", candidateId);
  if (error) throw new Error(error.message);
}

export async function assignEntity(candidateId: number, drinkId: string | null, foodId: string | null) {
  const sb = need();
  const patch: Record<string, unknown> = {};
  if (drinkId) patch.drink_id = drinkId;
  if (foodId) patch.food_id = foodId;
  const { data, error } = await sb.from("pairing_candidates").update(patch).eq("id", candidateId).select("drink_id,food_id").single();
  if (error || !data) throw new Error(error?.message || "지정 실패");
  if (data.drink_id && data.food_id) await sb.from("pairing_candidates").update({ status: "draft" }).eq("id", candidateId);
  return data;
}

/**
 * 발행: 스냅샷 저장 → counts → catalog_meta.version 갱신 → 앱이 다음 시작 때 받는다.
 * 순서가 중요하다. version을 먼저 올리면 스냅샷 저장이 실패했을 때 "무엇을 발행했는지" 기록 없이
 * 새 버전만 전 사용자에게 나가 되돌릴 근거가 사라진다. 그래서 되돌릴 수 있는 것부터 쓴다.
 */
export async function publish(note: string) {
  const sb = need();
  invalidateCatalog();
  const c = await getCatalog();
  if (c.source !== "db") throw new Error("DB 카탈로그가 아니어서 발행할 수 없어요 (정적 폴백 상태)");
  const version = new Date().toISOString();
  const counts = c.counts;
  const snap = await sb.from("catalog_snapshots").insert({ version, counts, data: c.dataset, note });
  if (snap.error) throw new Error(`스냅샷 저장 실패 — 발행하지 않았습니다: ${snap.error.message}`);
  const cnt = await sb.from("catalog_meta").upsert({ key: "counts", value: counts, updated_at: version });
  if (cnt.error) throw new Error(`counts 저장 실패 — 발행하지 않았습니다: ${cnt.error.message}`);
  const ver = await sb.from("catalog_meta").upsert({ key: "version", value: version, updated_at: version });
  if (ver.error) throw new Error(`버전 갱신 실패 — 스냅샷 ${version}은 저장됐지만 발행되지 않았습니다: ${ver.error.message}`);
  invalidateCatalog();
  return { version, counts };
}

export type SnapshotRow = { version: string; counts: { drinks: number; foods: number; pairings: number }; note: string | null; created_at: string };

/** 발행 이력 — 되돌릴 대상을 고르기 위한 목록. data(수 MB)는 제외하고 메타만 */
export async function listSnapshots(limit = 10): Promise<SnapshotRow[]> {
  const sb = need();
  const { data, error } = await sb.from("catalog_snapshots").select("version,counts,note,created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as SnapshotRow[];
}
