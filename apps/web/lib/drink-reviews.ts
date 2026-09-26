/**
 * 술 평가(별점·한줄평, docs/25 §1) — 저장·집계. service_role로만 접근.
 * 공개 화면에는 닉네임·별점·글·날짜만(이메일·성별 등은 주지 않는다). 규칙은 shared pairing/drink-review.ts.
 */
import { DRINK_REVIEWS_PER_DAY, DRINK_REVIEW_LIST_MAX, cleanReviewBody, drinkReviewProblem, summarizeStars, type StarSummary } from "@pairinggo/shared";
import { db } from "./db";

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정"); return sb; };
type Row = { id: number; drink_id: string; user_id: string; stars: number; body: string; status: "active" | "hidden"; hidden_reason: string | null; created_at: string; updated_at: string; users?: { name: string | null } | null; drinks?: { name: string | null } | null };
const nickOf = (r: Row) => (r.users?.name || "회원").slice(0, 20);

export type DrinkReviewItem = { id: number; nick: string; stars: number; body: string; at: string; mine: boolean };
export type DrinkReviewView = { summary: StarSummary; list: DrinkReviewItem[]; mine: { stars: number; body: string } | null };

/** 상세 머리 카드용 요약(인원·평균) — DB가 없으면 0명 */
export async function drinkReviewSummary(drinkId: string): Promise<StarSummary> {
  const sb = db();
  if (!sb) return summarizeStars([]);
  const { data } = await sb.from("drink_reviews").select("stars").eq("drink_id", drinkId).eq("status", "active").limit(5000);
  return summarizeStars(((data ?? []) as { stars: number }[]).map((r) => r.stars));
}

/** 평가 칸 — 요약 + 최근 20개 + 내 평가 */
export async function drinkReviewsFor(drinkId: string, userId: string | null): Promise<DrinkReviewView> {
  const sb = db();
  if (!sb) return { summary: summarizeStars([]), list: [], mine: null };
  const [{ data: all }, { data: recent }] = await Promise.all([
    sb.from("drink_reviews").select("stars,user_id,body").eq("drink_id", drinkId).eq("status", "active").limit(5000),
    sb.from("drink_reviews").select("*,users!drink_reviews_user_id_fkey(name)").eq("drink_id", drinkId).eq("status", "active").order("updated_at", { ascending: false }).limit(DRINK_REVIEW_LIST_MAX),
  ]);
  const rows = (all ?? []) as Pick<Row, "stars" | "user_id" | "body">[];
  const my = userId ? rows.find((r) => r.user_id === userId) : null;
  return {
    summary: summarizeStars(rows.map((r) => r.stars)),
    list: ((recent ?? []) as Row[]).map((r) => ({ id: r.id, nick: nickOf(r), stars: r.stars, body: r.body, at: r.updated_at, mine: !!userId && r.user_id === userId })),
    mine: my ? { stars: my.stars, body: my.body } : null,
  };
}

/** 저장(있으면 수정). 하루 20개 — 새 술에만 센다 */
export async function setDrinkReview(userId: string, drinkId: string, stars: number, bodyRaw: unknown): Promise<void> {
  const sb = need();
  const problem = drinkReviewProblem({ stars, body: bodyRaw });
  if (problem) throw new Error(problem);
  const body = cleanReviewBody(bodyRaw);
  const { data: existing } = await sb.from("drink_reviews").select("id").eq("drink_id", drinkId).eq("user_id", userId).maybeSingle();
  if (!existing) {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await sb.from("drink_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if ((count ?? 0) >= DRINK_REVIEWS_PER_DAY) throw new Error(`하루에 ${DRINK_REVIEWS_PER_DAY}개까지 평가할 수 있어요.`);
  }
  const now = new Date().toISOString();
  const { error } = await sb.from("drink_reviews").upsert({ drink_id: drinkId, user_id: userId, stars, body, status: "active", hidden_reason: null, updated_at: now }, { onConflict: "drink_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function deleteDrinkReview(userId: string, drinkId: string): Promise<void> {
  const { error } = await need().from("drink_reviews").delete().eq("drink_id", drinkId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/* ---------- 어드민 ---------- */
export type AdminDrinkReview = { id: number; drinkId: string; drinkName: string; nick: string; stars: number; body: string; status: "active" | "hidden"; hiddenReason: string; at: string };

export async function adminDrinkReviews(view: "all" | "hidden", limit = 150): Promise<AdminDrinkReview[]> {
  const sb = need();
  let q = sb.from("drink_reviews").select("*,users!drink_reviews_user_id_fkey(name),drinks!drink_reviews_drink_id_fkey(name)").order("updated_at", { ascending: false }).limit(limit);
  if (view === "hidden") q = q.eq("status", "hidden");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id, drinkId: r.drink_id, drinkName: r.drinks?.name || r.drink_id, nick: nickOf(r), stars: r.stars, body: r.body, status: r.status, hiddenReason: r.hidden_reason ?? "", at: r.updated_at }));
}

export async function adminActDrinkReview(id: number, action: "hide" | "restore" | "delete", reason = ""): Promise<void> {
  const sb = need();
  if (!Number.isInteger(id) || id <= 0) throw new Error("잘못된 id");
  const r = action === "delete"
    ? await sb.from("drink_reviews").delete().eq("id", id)
    : await sb.from("drink_reviews").update(action === "hide" ? { status: "hidden", hidden_reason: reason.slice(0, 200) || null } : { status: "active", hidden_reason: null }).eq("id", id);
  if (r.error) throw new Error(r.error.message);
}
