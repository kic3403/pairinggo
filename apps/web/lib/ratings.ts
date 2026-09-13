/**
 * '먹어봤어요' 평가 — 저장·집계. service_role로만 접근하고, 공개 화면에는 집계와 "내 평가"만 준다(누가 뭐라고 했는지는 주지 않는다).
 * 요약 규칙은 packages/shared/src/pairing/ratings.ts.
 */
import type { RatingCounts, RatingValue } from "@pairinggo/shared";
import { db } from "./db";

type Row = { user_id: string; drink_id: string; food_id: string; rating: RatingValue };
const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정"); return sb; };

/** 한 술(또는 한 음식)의 조합별 집계 + 로그인한 회원이면 내 평가. 키는 "d01|f02" */
export async function ratingsFor(subject: { drink?: string; food?: string }, userId: string | null) {
  const sb = db();
  if (!sb) return { counts: {} as Record<string, RatingCounts>, mine: {} as Record<string, RatingValue> };
  let q = sb.from("pairing_ratings").select("user_id,drink_id,food_id,rating").limit(5000);
  if (subject.drink) q = q.eq("drink_id", subject.drink);
  else if (subject.food) q = q.eq("food_id", subject.food);
  else return { counts: {}, mine: {} };
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const counts: Record<string, RatingCounts> = {};
  const mine: Record<string, RatingValue> = {};
  for (const r of (data || []) as Row[]) {
    const k = `${r.drink_id}|${r.food_id}`;
    const c = (counts[k] ||= { good: 0, ok: 0, bad: 0 });
    c[r.rating]++;
    if (userId && r.user_id === userId) mine[k] = r.rating;
  }
  return { counts, mine };
}

/** 내 평가 저장(같은 조합이면 덮어씀). rating이 null이면 지운다 */
export async function setRating(userId: string, drinkId: string, foodId: string, rating: RatingValue | null) {
  const sb = need();
  if (rating === null) {
    const { error } = await sb.from("pairing_ratings").delete().eq("user_id", userId).eq("drink_id", drinkId).eq("food_id", foodId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await sb.from("pairing_ratings").upsert(
    { user_id: userId, drink_id: drinkId, food_id: foodId, rating, updated_at: new Date().toISOString() },
    { onConflict: "user_id,drink_id,food_id" },
  );
  if (error) throw new Error(error.message);
}
