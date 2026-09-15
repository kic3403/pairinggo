/**
 * 근거 검수 대기열(docs/20 P2-1) — 미검수 후보 수천 건 중 "근거가 하나도 없는 술·음식"을 채우는 후보부터 검수한다.
 * 근거 = 출처 등급이 official·sommelier·media·blog·user인 페어링(맛 분석 profile·ai는 근거가 아니다).
 * 규칙
 *  · 술·음식이 지정되지 않은 후보, 이미 근거가 있는 조합, 술·음식 모두 근거가 있는 후보는 뺀다
 *  · 같은 조합 후보는 1장으로 묶는다(대표 = 등급 높은 → 언급 많은 → 먼저 들어온 것), 나머지 수는 others
 *  · 우선순위 = 빈칸(술 +50, 음식 +50) + 등급×10 + 언급 수(최대 20) + 같은 조합 다른 출처(최대 5개×3)
 *  · 한 술(음식)이 대기열을 독차지하지 않게, 같은 빈칸 술·음식이 이미 뽑힌 만큼 REPEAT_PENALTY씩 뺀다
 */
import { SRC_RANK } from "../data";
import type { Pairing } from "../types";

export const EVIDENCE_TIERS = ["official", "sommelier", "media", "blog", "user"] as const;
export const REVIEW_PAGE = 50;
export const REPEAT_PENALTY = 40;

export type EvidenceGaps = { drinks: Set<string>; foods: Set<string>; pairs: Set<string> };

/** 근거 없는 술·음식 id와, 근거가 이미 있는 조합 "d|f" */
export function evidenceGaps(ds: { drinks: { id: string }[]; foods: { id: string }[]; pairings: Pick<Pairing, "d" | "f" | "src">[] }): EvidenceGaps {
  const dEv = new Set<string>(), fEv = new Set<string>(), pairs = new Set<string>();
  for (const p of ds.pairings) {
    if (!p.src || !(EVIDENCE_TIERS as readonly string[]).includes(p.src)) continue;
    dEv.add(p.d); fEv.add(p.f); pairs.add(`${p.d}|${p.f}`);
  }
  return {
    drinks: new Set(ds.drinks.map((d) => d.id).filter((id) => !dEv.has(id))),
    foods: new Set(ds.foods.map((f) => f.id).filter((id) => !fEv.has(id))),
    pairs,
  };
}

export type QueueCandidate = { id: number; drink_id: string | null; food_id: string | null; suggested_tier: string | null; mention_count: number };
export type QueueItem<T> = { item: T; priority: number; gap: "both" | "drink" | "food"; others: number };

const tierRank = (t: string | null) => (t ? (SRC_RANK as Record<string, number>)[t] ?? 0 : 0);
const better = (a: QueueCandidate, b: QueueCandidate) =>
  tierRank(a.suggested_tier) - tierRank(b.suggested_tier) || (a.mention_count || 0) - (b.mention_count || 0) || b.id - a.id;

export function buildReviewQueue<T extends QueueCandidate>(cands: T[], gaps: EvidenceGaps, opts: { page?: number; size?: number } = {}): { items: QueueItem<T>[]; totalPairs: number; totalCandidates: number } {
  const groups = new Map<string, { best: T; n: number }>();
  let totalCandidates = 0;
  for (const c of cands) {
    if (!c.drink_id || !c.food_id) continue;
    const key = `${c.drink_id}|${c.food_id}`;
    if (gaps.pairs.has(key)) continue;
    if (!gaps.drinks.has(c.drink_id) && !gaps.foods.has(c.food_id)) continue;
    totalCandidates++;
    const g = groups.get(key);
    if (!g) groups.set(key, { best: c, n: 1 });
    else { g.n++; if (better(c, g.best) > 0) g.best = c; }
  }
  const pool = [...groups.values()].map(({ best, n }) => {
    const gd = gaps.drinks.has(best.drink_id!), gf = gaps.foods.has(best.food_id!);
    const priority = (gd ? 50 : 0) + (gf ? 50 : 0) + tierRank(best.suggested_tier) * 10 + Math.min(best.mention_count || 0, 20) + Math.min(n - 1, 5) * 3;
    return { item: best, priority, gap: (gd && gf ? "both" : gd ? "drink" : "food") as QueueItem<T>["gap"], others: n - 1 };
  });
  const size = opts.size ?? REVIEW_PAGE, page = Math.max(0, opts.page ?? 0);
  const want = Math.min(pool.length, size * (page + 1));
  // 탐욕 선택: 이미 뽑힌 같은 빈칸 술·음식 수만큼 감점해 여러 술·음식에 고르게 퍼뜨린다
  const usedD = new Map<string, number>(), usedF = new Map<string, number>();
  const picked: QueueItem<T>[] = [];
  const left = new Set(pool.map((_, i) => i));
  while (picked.length < want) {
    let bi = -1, bs = -Infinity;
    for (const i of left) {
      const q = pool[i];
      const pen = REPEAT_PENALTY * ((q.gap !== "food" ? usedD.get(q.item.drink_id!) ?? 0 : 0) + (q.gap !== "drink" ? usedF.get(q.item.food_id!) ?? 0 : 0));
      const s = q.priority - pen;
      if (s > bs || (s === bs && q.item.id < pool[bi].item.id)) { bs = s; bi = i; }
    }
    const q = pool[bi];
    left.delete(bi); picked.push(q);
    if (q.gap !== "food") usedD.set(q.item.drink_id!, (usedD.get(q.item.drink_id!) ?? 0) + 1);
    if (q.gap !== "drink") usedF.set(q.item.food_id!, (usedF.get(q.item.food_id!) ?? 0) + 1);
  }
  return { items: picked.slice(size * page), totalPairs: pool.length, totalCandidates };
}
