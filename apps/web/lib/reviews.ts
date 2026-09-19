/**
 * 식당 리뷰(2026-09-19 사용자 결정 A: 방문 인증 리뷰만) — 서버 전용.
 *  쓰기 조건: 로그인 + 휴대폰 문자 인증 + 방문 인증(① 이 매장 예약을 방문 완료 ② 영수증 사진 인증) + 매장 사장님 본인이 아님
 *  방문 한 번에 하나(예약 id·영수증 해시 고유), 하루 5개·영수증 읽기 하루 5번. 신고 3건이면 숨김 → /admin/reviews
 *  공개 목록에는 닉네임만(회원 id·번호·이메일 없음). 영수증 사진은 저장하지 않고 해시만.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  cleanReviewInput, kstParts, receiptKey, receiptProblem, reviewStats, RECEIPT_READS_PER_DAY, REVIEW_PHOTO_BUCKET, REVIEW_REPORT_HIDE, REVIEWS_PER_DAY,
  type PublicReview, type ReviewStats, type ReviewVerifyKind,
} from "@pairinggo/shared";
import { readReceipt, receiptReadConfigured, receiptReadError } from "@pairinggo/server/receipt-read";
import { reportError } from "@pairinggo/server/errors";
import { db } from "./db";
import { placeBase } from "./place-detail";

const need = () => { const c = db(); if (!c) throw new Error("지금은 리뷰를 쓸 수 없어요"); return c; };
const today = () => kstParts(new Date()).date;
const since24h = () => new Date(Date.now() - 86400_000).toISOString();

/* ---------- 공개 목록 ---------- */

type Row = { id: number; rating: number; body: string; photos: unknown; verify_kind: ReviewVerifyKind; visit_date: string; created_at: string; users?: { name: string | null } | null };
const toPublic = (r: Row): PublicReview => ({
  id: Number(r.id), rating: Number(r.rating), body: String(r.body), photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
  nickname: r.users?.name || "회원", verify: r.verify_kind, visitDate: String(r.visit_date), createdAt: String(r.created_at),
});

export async function placeReviews(kakaoId: string, limit = 50): Promise<{ stats: ReviewStats; reviews: PublicReview[] }> {
  const c = db();
  if (!c) return { stats: { count: 0, avg: null }, reviews: [] };
  const [list, all] = await Promise.all([
    c.from("place_reviews").select("id, rating, body, photos, verify_kind, visit_date, created_at, users!place_reviews_user_id_fkey(name)")
      .eq("kakao_id", kakaoId).eq("status", "active").order("created_at", { ascending: false }).limit(limit),
    c.from("place_reviews").select("rating").eq("kakao_id", kakaoId).eq("status", "active").limit(5000),
  ]);
  return { stats: reviewStats((all.data ?? []).map((r) => Number(r.rating))), reviews: ((list.data ?? []) as unknown as Row[]).map(toPublic) };
}

/** 식당 카드용 — 여러 식당의 평균 별점·개수 */
export async function reviewStatsFor(kakaoIds: string[]): Promise<Map<string, ReviewStats>> {
  const c = db();
  const out = new Map<string, ReviewStats>();
  if (!c || !kakaoIds.length) return out;
  const { data } = await c.from("place_reviews").select("kakao_id, rating").in("kakao_id", kakaoIds).eq("status", "active").limit(5000);
  const by = new Map<string, number[]>();
  for (const r of data ?? []) by.set(String(r.kakao_id), [...(by.get(String(r.kakao_id)) ?? []), Number(r.rating)]);
  for (const [k, v] of by) out.set(k, reviewStats(v));
  return out;
}

/* ---------- 쓸 수 있는지 ---------- */

export type ReviewGate = {
  phoneVerified: boolean; ownerBlocked: boolean; receiptAvailable: boolean;
  /** 이 매장에서 방문 완료했고 아직 리뷰를 안 쓴 예약 */
  reservations: { id: string; date: string; time: string }[];
  myReviewIds: number[];
};

/** 이 매장 사장님·직원 번호로 인증한 회원인가 — 자기 매장 리뷰 금지 */
async function isOwner(userPhone: string | null, kakaoId: string): Promise<boolean> {
  if (!userPhone) return false;
  const c = need();
  const { data: m } = await c.from("merchants").select("id").eq("kakao_place_id", kakaoId).maybeSingle();
  if (!m) return false;
  const { data } = await c.from("merchant_members").select("partner_users(phone)").eq("merchant_id", m.id);
  return (data ?? []).some((r) => (r.partner_users as unknown as { phone?: string } | null)?.phone === userPhone);
}

export async function reviewGate(userId: string, kakaoId: string): Promise<ReviewGate> {
  const c = need();
  const { data: u } = await c.from("users").select("phone, phone_verified_at").eq("id", userId).maybeSingle();
  const phone = (u?.phone as string | null) ?? null;
  const [owner, done, mine] = await Promise.all([
    isOwner(u?.phone_verified_at ? phone : null, kakaoId),
    c.from("reservations").select("id, visit_date, visit_time, merchants!inner(kakao_place_id)").eq("user_id", userId).eq("status", "completed").eq("merchants.kakao_place_id", kakaoId).order("visit_date", { ascending: false }).limit(20),
    c.from("place_reviews").select("id, reservation_id").eq("user_id", userId).eq("kakao_id", kakaoId),
  ]);
  const used = new Set((mine.data ?? []).map((r) => String(r.reservation_id ?? "")));
  return {
    phoneVerified: !!u?.phone_verified_at, ownerBlocked: owner, receiptAvailable: receiptReadConfigured(),
    reservations: (done.data ?? []).filter((r) => !used.has(String(r.id))).map((r) => ({ id: String(r.id), date: String(r.visit_date), time: String(r.visit_time ?? "").slice(0, 5) })),
    myReviewIds: (mine.data ?? []).map((r) => Number(r.id)),
  };
}

/* ---------- 영수증 인증 → 30분짜리 서명 표(영수증 사진은 버린다) ---------- */

const secret = () => process.env.AUTH_SECRET || "";
const sign = (s: string) => createHmac("sha256", secret()).update(`review-receipt:${s}`).digest("base64url");
type ReceiptTicket = { u: string; k: string; d: string; h: string; exp: number };
function seal(t: Omit<ReceiptTicket, "exp">): string {
  const body = Buffer.from(JSON.stringify({ ...t, exp: Date.now() + 30 * 60_000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}
function open(v: string): ReceiptTicket | null {
  const [body, sig] = String(v ?? "").split(".");
  if (!body || !sig || !secret()) return null;
  const want = sign(body);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const t = JSON.parse(Buffer.from(body, "base64url").toString()) as ReceiptTicket; return t.exp > Date.now() ? t : null; } catch { return null; }
}
const receiptHash = (key: string) => createHash("sha256").update(`${secret()}|${key}`).digest("hex");

export type ReceiptResult = { ok: true; ticket: string; storeName: string; visitDate: string } | { ok: false; status: number; problem: string };

export async function verifyReceipt(userId: string, kakaoId: string, placeName: string, image: string): Promise<ReceiptResult> {
  if (!receiptReadConfigured()) return { ok: false, status: 503, problem: "영수증 인증을 준비하고 있어요" };
  if (typeof image !== "string" || image.length < 1000 || image.length > 4_000_000) return { ok: false, status: 400, problem: "영수증 사진을 골라 주세요" };
  const c = need();
  const gate = await reviewGate(userId, kakaoId);
  if (!gate.phoneVerified) return { ok: false, status: 403, problem: "휴대폰 인증을 먼저 해 주세요" };
  if (gate.ownerBlocked) return { ok: false, status: 403, problem: "내 매장에는 리뷰를 쓸 수 없어요" };
  const { count } = await c.from("receipt_reads").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since24h());
  if ((count ?? 0) >= RECEIPT_READS_PER_DAY) return { ok: false, status: 429, problem: `영수증 인증은 하루 ${RECEIPT_READS_PER_DAY}번까지예요 — 내일 다시 시도해 주세요` };
  const place = await placeBase(kakaoId, placeName);
  if (!place) return { ok: false, status: 404, problem: "식당을 찾지 못했어요 — 식당 화면에서 다시 시도해 주세요" };

  const log = (ok: boolean, error = "") => c.from("receipt_reads").insert({ user_id: userId, kakao_id: kakaoId, ok, error: error.slice(0, 200) });
  let read;
  try { read = await readReceipt({ type: "image/jpeg", data: image }); }
  catch (e) {
    const m = receiptReadError(e);
    await log(false, m.error);
    if (m.status >= 500) void reportError("web", "reviews/receipt", e);
    return { ok: false, status: m.status, problem: m.error };
  }
  const problem = receiptProblem(read, place, today());
  if (problem) { await log(false, problem); return { ok: false, status: 400, problem }; }
  const h = receiptHash(receiptKey(read));
  const { data: dup } = await c.from("place_reviews").select("id").eq("receipt_hash", h).maybeSingle();
  if (dup) { await log(false, "이미 쓴 영수증"); return { ok: false, status: 409, problem: "이미 리뷰에 쓴 영수증이에요 — 방문 한 번에 리뷰 하나만 쓸 수 있어요" }; }
  await log(true);
  return { ok: true, ticket: seal({ u: userId, k: kakaoId, d: read.date, h }), storeName: read.storeName, visitDate: read.date };
}

/* ---------- 쓰기·지우기·신고 ---------- */

export type ReviewInput = { kakaoId: string; placeName: string; rating: unknown; body: unknown; photos: unknown; reservationId?: string | null; receiptTicket?: string | null };

export async function createReview(userId: string, input: ReviewInput): Promise<{ ok: true; id: number } | { ok: false; status: number; problem: string }> {
  const no = (status: number, problem: string) => ({ ok: false as const, status, problem });
  const kakaoId = String(input.kakaoId ?? "");
  if (!/^\d{1,20}$/.test(kakaoId)) return no(400, "식당을 찾지 못했어요");
  const v = cleanReviewInput(input);
  if (!v.ok) return no(400, v.problem);
  // 사진은 이 회원 폴더에 올린 것만(남의 사진 주소를 붙이지 못하게)
  if (v.value.photos.some((u) => !u.includes(`/${REVIEW_PHOTO_BUCKET}/${userId}/`))) return no(400, "사진을 다시 올려 주세요");
  const c = need();
  const gate = await reviewGate(userId, kakaoId);
  if (!gate.phoneVerified) return no(403, "휴대폰 인증을 먼저 해 주세요");
  if (gate.ownerBlocked) return no(403, "내 매장에는 리뷰를 쓸 수 없어요");
  const { count } = await c.from("place_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since24h());
  if ((count ?? 0) >= REVIEWS_PER_DAY) return no(429, `리뷰는 하루 ${REVIEWS_PER_DAY}개까지 쓸 수 있어요`);

  let verify: { kind: ReviewVerifyKind; visitDate: string; reservationId: string | null; receiptHash: string | null };
  if (input.reservationId) {
    const r = gate.reservations.find((x) => x.id === String(input.reservationId));
    if (!r) return no(400, "방문 완료된 예약을 찾지 못했어요");
    verify = { kind: "reservation", visitDate: r.date, reservationId: r.id, receiptHash: null };
  } else if (input.receiptTicket) {
    const t = open(input.receiptTicket);
    if (!t || t.u !== userId || t.k !== kakaoId) return no(400, "영수증 인증 시간이 지났어요 — 다시 인증해 주세요");
    verify = { kind: "receipt", visitDate: t.d, reservationId: null, receiptHash: t.h };
  } else return no(400, "방문 인증이 필요해요 — 예약 방문을 고르거나 영수증을 인증해 주세요");

  const place = await placeBase(kakaoId, input.placeName);
  if (!place) return no(404, "식당을 찾지 못했어요");
  const { data, error } = await c.from("place_reviews").insert({
    kakao_id: kakaoId, place_name: place.name.slice(0, 80), place_address: place.address.slice(0, 200), user_id: userId,
    rating: v.value.rating, body: v.value.body, photos: v.value.photos, verify_kind: verify.kind,
    reservation_id: verify.reservationId, receipt_hash: verify.receiptHash, visit_date: verify.visitDate,
  }).select("id").single();
  if (error) return no(error.code === "23505" ? 409 : 500, error.code === "23505" ? "이미 리뷰를 쓴 방문이에요 — 방문 한 번에 리뷰 하나만 쓸 수 있어요" : "리뷰를 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요");
  return { ok: true, id: Number(data.id) };
}

const photoPath = (url: string) => url.slice(url.indexOf(`/${REVIEW_PHOTO_BUCKET}/`) + REVIEW_PHOTO_BUCKET.length + 2);

export async function deleteMyReview(userId: string, id: number): Promise<boolean> {
  const c = need();
  const { data } = await c.from("place_reviews").delete().eq("id", id).eq("user_id", userId).select("photos, kakao_id").maybeSingle();
  if (!data) return false;
  const paths = (Array.isArray(data.photos) ? (data.photos as string[]) : []).map(photoPath);
  if (paths.length) await c.storage.from(REVIEW_PHOTO_BUCKET).remove(paths).catch(() => null);
  return true;
}

export async function reportReview(userId: string, id: number, reason: string): Promise<{ ok: true; hidden: boolean } | { ok: false; problem: string }> {
  const c = need();
  const { data: r } = await c.from("place_reviews").select("user_id, status").eq("id", id).maybeSingle();
  if (!r || r.status !== "active") return { ok: false, problem: "리뷰를 찾지 못했어요" };
  if (r.user_id === userId) return { ok: false, problem: "내 리뷰는 신고할 수 없어요 — 지우려면 [삭제]를 눌러 주세요" };
  const { error } = await c.from("review_reports").insert({ review_id: id, user_id: userId, reason: String(reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200) });
  if (error) return { ok: false, problem: error.code === "23505" ? "이미 신고한 리뷰예요" : "신고하지 못했어요" };
  const { count } = await c.from("review_reports").select("user_id", { count: "exact", head: true }).eq("review_id", id);
  const hidden = (count ?? 0) >= REVIEW_REPORT_HIDE;
  await c.from("place_reviews").update({ report_count: count ?? 0, ...(hidden ? { status: "hidden", hidden_reason: `신고 ${count}건 — 운영자 검토 대기` } : {}), updated_at: new Date().toISOString() }).eq("id", id);
  return { ok: true, hidden };
}

/* ---------- 리뷰 사진(쓰기 전에 한 장씩 올린다) ---------- */

export async function uploadReviewPhoto(userId: string, base64: string): Promise<string> {
  const c = need();
  const buf = Buffer.from(String(base64 ?? ""), "base64");
  if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw new Error("사진(JPG)만 올릴 수 있어요");
  if (buf.length > 1_000_000) throw new Error("사진이 너무 커요 — 1MB까지예요");
  const { data: files } = await c.storage.from(REVIEW_PHOTO_BUCKET).list(userId, { limit: 301 });
  if ((files?.length ?? 0) >= 300) throw new Error("올린 사진이 너무 많아요 — 잠시 뒤 다시 시도해 주세요");
  const path = `${userId}/${Date.now()}-${randomBytes(4).toString("hex")}.jpg`;
  const put = () => c.storage.from(REVIEW_PHOTO_BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
  let { error } = await put();
  if (error && /not found|bucket/i.test(error.message)) {
    await c.storage.createBucket(REVIEW_PHOTO_BUCKET, { public: true, fileSizeLimit: 1_000_000, allowedMimeTypes: ["image/jpeg"] }).catch(() => null);
    ({ error } = await put());
  }
  if (error) throw new Error("사진을 올리지 못했어요 — 잠시 뒤 다시 시도해 주세요");
  return c.storage.from(REVIEW_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 아침 크론 — 리뷰에 붙지 않은 채 하루 지난 사진(쓰다 만 것) 정리 */
export async function cleanupReviewPhotos(now = Date.now()): Promise<number> {
  const c = db();
  if (!c) return 0;
  const { data: folders } = await c.storage.from(REVIEW_PHOTO_BUCKET).list("", { limit: 1000 });
  let removed = 0;
  for (const f of folders ?? []) {
    const { data: files } = await c.storage.from(REVIEW_PHOTO_BUCKET).list(f.name, { limit: 1000 });
    const old = (files ?? []).filter((x) => new Date(x.created_at ?? now).getTime() < now - 86400_000);
    if (!old.length) continue;
    const { data: rows } = await c.from("place_reviews").select("photos").eq("user_id", f.name);
    const used = new Set((rows ?? []).flatMap((r) => (Array.isArray(r.photos) ? (r.photos as string[]) : [])).map((u) => u.slice(u.lastIndexOf("/") + 1)));
    const gone = old.filter((x) => !used.has(x.name)).map((x) => `${f.name}/${x.name}`);
    if (gone.length) { await c.storage.from(REVIEW_PHOTO_BUCKET).remove(gone); removed += gone.length; }
  }
  return removed;
}

/* ---------- 어드민 ---------- */

export type AdminReview = PublicReview & { kakaoId: string; placeName: string; status: "active" | "hidden"; reportCount: number; hiddenReason: string | null; reasons: string[]; userEmail: string | null };

export async function adminReviews(view: "reported" | "all"): Promise<AdminReview[]> {
  const c = need();
  let q = c.from("place_reviews").select("id, kakao_id, place_name, rating, body, photos, verify_kind, visit_date, created_at, status, report_count, hidden_reason, users!place_reviews_user_id_fkey(name, email), review_reports(reason)")
    .order("created_at", { ascending: false }).limit(200);
  if (view === "reported") q = q.or("report_count.gt.0,status.eq.hidden");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const u = r.users as unknown as { name: string | null; email: string | null } | null;
    return {
      ...toPublic(r as unknown as Row), kakaoId: String(r.kakao_id), placeName: String(r.place_name), status: r.status as "active" | "hidden",
      reportCount: Number(r.report_count), hiddenReason: (r.hidden_reason as string) ?? null, userEmail: u?.email ?? null,
      reasons: ((r.review_reports as unknown as { reason: string }[] | null) ?? []).map((x) => x.reason).filter(Boolean),
    };
  });
}

export async function adminActReview(id: number, action: "hide" | "restore" | "delete", reason = ""): Promise<void> {
  const c = need();
  const now = new Date().toISOString();
  if (action === "delete") {
    const { data } = await c.from("place_reviews").delete().eq("id", id).select("photos").maybeSingle();
    const paths = (Array.isArray(data?.photos) ? (data!.photos as string[]) : []).map(photoPath);
    if (paths.length) await c.storage.from(REVIEW_PHOTO_BUCKET).remove(paths).catch(() => null);
    return;
  }
  if (action === "hide") { await c.from("place_reviews").update({ status: "hidden", hidden_reason: reason.slice(0, 200) || "운영자 숨김", updated_at: now }).eq("id", id); return; }
  // 복구: 신고 기록도 비워 다시 3건이 쌓여야 숨겨지게
  await c.from("review_reports").delete().eq("review_id", id);
  await c.from("place_reviews").update({ status: "active", hidden_reason: null, report_count: 0, updated_at: now }).eq("id", id);
}
