/**
 * 사장님 리뷰 답글(2026-10-01) — 파트너가 자기 매장(kakao_place_id)의 방문 인증 리뷰에 답글 하나를 남긴다.
 * 손님 화면(places/[kakaoId] ReviewList)에 "사장님 답글"로 보인다. 빈 글로 저장하면 답글을 지운다. 규칙은 shared reviews.ts cleanOwnerReply.
 */
import { cleanOwnerReply, cleanPushPref } from "@pairinggo/shared";
import { db } from "./db";
import { pushConfigured, pushTo } from "./push";
import type { Merchant } from "./reservations";

export type MerchantReview = {
  id: number; rating: number; body: string; photos: string[]; nickname: string; verify: "reservation" | "receipt"; visitDate: string; createdAt: string;
  reply: { body: string; at: string } | null;
};

type Row = { id: number; rating: number; body: string; photos: unknown; verify_kind: "reservation" | "receipt"; visit_date: string; created_at: string; owner_reply: string | null; owner_reply_at: string | null; users?: { name: string | null } | null };

/** 내 매장의 공개 리뷰(최근 100개) */
export async function listMerchantReviews(merchant: Pick<Merchant, "kakaoPlaceId">): Promise<MerchantReview[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("place_reviews")
    .select("id, rating, body, photos, verify_kind, visit_date, created_at, owner_reply, owner_reply_at, users!place_reviews_user_id_fkey(name)")
    .eq("kakao_id", merchant.kakaoPlaceId).eq("status", "active").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: Number(r.id), rating: Number(r.rating), body: String(r.body), photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    nickname: r.users?.name || "회원", verify: r.verify_kind, visitDate: String(r.visit_date), createdAt: String(r.created_at),
    reply: r.owner_reply ? { body: String(r.owner_reply), at: String(r.owner_reply_at ?? r.created_at) } : null,
  }));
}

/** 답글 저장 — 내 매장 리뷰가 아니면 거부. 빈 글이면 답글 삭제 */
export async function saveOwnerReply(merchant: Pick<Merchant, "kakaoPlaceId">, reviewId: number, raw: unknown): Promise<{ ok: true; reply: { body: string; at: string } | null } | { ok: false; error: string }> {
  const c = db();
  if (!c) return { ok: false, error: "DB가 연결되지 않았어요" };
  if (!Number.isInteger(reviewId) || reviewId <= 0) return { ok: false, error: "리뷰를 찾지 못했어요" };
  const { data: row } = await c.from("place_reviews").select("id, kakao_id, status, user_id, place_name, owner_reply").eq("id", reviewId).maybeSingle();
  if (!row || String(row.kakao_id) !== merchant.kakaoPlaceId) return { ok: false, error: "우리 매장 리뷰가 아니에요" };
  if (row.status !== "active") return { ok: false, error: "숨겨진 리뷰에는 답글을 달 수 없어요" };
  const v = cleanOwnerReply(raw);
  if (!v.ok) return { ok: false, error: v.problem };
  const at = v.value ? new Date().toISOString() : null;
  const { error } = await c.from("place_reviews").update({ owner_reply: v.value || null, owner_reply_at: at }).eq("id", reviewId);
  if (error) return { ok: false, error: "저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  // 처음 다는 답글만 알린다(고칠 때는 조용히). 알림함(web myActivity)에는 저장만으로 뜬다
  if (v.value && !row.owner_reply) void notifyReviewer(String(row.user_id), String(row.place_name), String(row.kakao_id), v.value);
  return { ok: true, reply: v.value ? { body: v.value, at: at! } : null };
}

/** 리뷰 쓴 회원에게 푸시 — 활동 알림(users.push_pref.activity)을 켠 회원만. 실패는 기록만 */
async function notifyReviewer(userId: string, placeName: string, kakaoId: string, body: string): Promise<void> {
  try {
    if (!pushConfigured()) return;
    const c = db();
    if (!c) return;
    const { data } = await c.from("users").select("push_pref").eq("id", userId).maybeSingle();
    if (!cleanPushPref(data?.push_pref).activity) return;
    await pushTo("user", userId, { title: `${placeName} 사장님 답글`, body: body.length > 80 ? body.slice(0, 79) + "…" : body, url: `/places/${kakaoId}?n=${encodeURIComponent(placeName)}#reviews`, tag: `reply-${kakaoId}` });
  } catch (e) { console.warn("[push] review reply", (e as Error).message); }
}
