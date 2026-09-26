/**
 * 회원 추천 페어링 — 글(member_picks)·하트(member_pick_likes)·집계·회원픽 카드 생성. 규칙은 packages/shared/src/pairing/member.ts.
 *  - 글은 올리면 바로 목록에 보인다(2026-09-14 개정). 다른 회원이 하트를 눌러 공감하고, 목록은 하트 많은 순 → 최근 순.
 *  - 같은 조합에 글이 MEMBER_PICK_MIN건 모이거나 한 글이 하트 MEMBER_PICK_LIKES_MIN개를 받으면 pairings에 src 'user' 행(회원픽 카드)을 만든다(syncPair).
 *  - 카탈로그에 없는 술/음식은 review 상태 → 어드민이 지정하면 게시. 화면에는 닉네임(users.name)만 나간다.
 */
import { revalidatePath } from "next/cache";
import { D, F, MEMBER_IMAGE_MAX_BYTES, MEMBER_IMAGE_TYPES, MEMBER_PICK_DAILY, MEMBER_PICK_ES, likePush, memberPickPublishes, profileFit, type MemberPickStatus } from "@pairinggo/shared";
import { countPairBlog } from "./blog-count";
import { getCatalog, invalidateCatalog } from "./catalog";
import { db } from "./db";
import { activityPush } from "./push-digest";

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정"); return sb; };
const key = (d: string, f: string) => `${d}|${f}`;

export type PickRow = {
  id: number; user_id: string; drink_id: string | null; food_id: string | null; drink_raw: string | null; food_raw: string | null;
  note: string; image_url: string | null; status: MemberPickStatus; review_note: string | null; created_at: string;
  users?: { name: string | null } | null;
};
/** 화면용 글 — 닉네임·하트 수만 나간다 */
export type PickPost = { id: number; d: string; f: string; drink: string; food: string; nick: string; note: string; image: string | null; likes: number; at: string; mine: boolean };
/** 조합별 집계(카드 줄용) */
export type PublicPick = { d: string; f: string; n: number; likes: number; notes: { nick: string; note: string; image: string | null; at: string }[]; latest: string };

// users 조인은 FK 이름을 지정한다 — member_pick_likes(→users)가 생긴 뒤 관계가 둘이라 PostgREST가 고르지 못한다(실측 2026-09-14)
const nickOf = (r: PickRow) => (r.users?.name || "회원").slice(0, 20);

/** 글 id별 하트 수 */
async function likeCounts(ids: number[]): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  const sb = db();
  if (!sb || !ids.length) return m;
  const { data } = await sb.from("member_pick_likes").select("pick_id").in("pick_id", ids).limit(50000);
  for (const r of (data ?? []) as { pick_id: number }[]) m.set(r.pick_id, (m.get(r.pick_id) ?? 0) + 1);
  return m;
}

const toPost = (r: PickRow, likes: Map<number, number>, uid: string | null): PickPost => ({
  id: r.id, d: r.drink_id!, f: r.food_id!, drink: D[r.drink_id!]?.name ?? r.drink_id!, food: F[r.food_id!]?.name ?? r.food_id!,
  nick: nickOf(r), note: r.note, image: r.image_url, likes: likes.get(r.id) ?? 0, at: r.created_at, mine: !!uid && r.user_id === uid,
});
const byLikes = (a: PickPost, b: PickPost) => b.likes - a.likes || b.at.localeCompare(a.at);

/** 회원 추천 목록·홈 — 게시된 글 전부, 하트 많은 순 */
export async function listPosts(limit = 60, userId: string | null = null): Promise<PickPost[]> {
  const sb = db();
  if (!sb) return [];
  await getCatalog();
  const { data, error } = await sb.from("member_picks").select("*,users!member_picks_user_id_fkey(name)").eq("status", "active").not("drink_id", "is", null).not("food_id", "is", null).order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PickRow[];
  const likes = await likeCounts(rows.map((r) => r.id));
  return rows.map((r) => toPost(r, likes, userId)).sort(byLikes).slice(0, limit);
}

/** 한 술(또는 음식) 화면 — 조합별 집계(글 수·하트 합·대표 글) + 내 글 키 */
export async function picksFor(subject: { drink?: string; food?: string }, userId: string | null) {
  const sb = db();
  if (!sb || (!subject.drink && !subject.food)) return { picks: {} as Record<string, PublicPick>, mine: [] as string[] };
  let q = sb.from("member_picks").select("*,users!member_picks_user_id_fkey(name)").eq("status", "active").limit(5000);
  q = subject.drink ? q.eq("drink_id", subject.drink) : q.eq("food_id", subject.food!);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as PickRow[]).filter((r) => r.drink_id && r.food_id);
  const likes = await likeCounts(rows.map((r) => r.id));
  const by = new Map<string, PickRow[]>();
  for (const r of rows) { const k = key(r.drink_id!, r.food_id!); by.set(k, [...(by.get(k) ?? []), r]); }
  const picks: Record<string, PublicPick> = {};
  for (const [k, rs] of by) {
    rs.sort((a, b) => (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0) || b.created_at.localeCompare(a.created_at));
    picks[k] = { d: rs[0].drink_id!, f: rs[0].food_id!, n: rs.length, likes: rs.reduce((s, r) => s + (likes.get(r.id) ?? 0), 0), notes: rs.filter((r) => r.note || r.image_url).slice(0, 3).map((r) => ({ nick: nickOf(r), note: r.note, image: r.image_url, at: r.created_at })), latest: rs.map((r) => r.created_at).sort().at(-1)! };
  }
  return { picks, mine: userId ? rows.filter((r) => r.user_id === userId).map((r) => key(r.drink_id!, r.food_id!)) : [] };
}

export type MyPick = PickRow & { n: number; likes: number };
/** 내 글 + 같은 조합의 글 수·이 글의 하트 수 */
export async function myPicks(userId: string): Promise<MyPick[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb.from("member_picks").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PickRow[];
  const pairs = rows.filter((r) => r.drink_id && r.food_id);
  const counts = new Map<string, number>();
  if (pairs.length) {
    const { data: all } = await sb.from("member_picks").select("drink_id,food_id").eq("status", "active").in("drink_id", [...new Set(pairs.map((r) => r.drink_id!))]).limit(5000);
    for (const r of (all ?? []) as { drink_id: string; food_id: string }[]) { const k = key(r.drink_id, r.food_id); counts.set(k, (counts.get(k) ?? 0) + 1); }
  }
  const likes = await likeCounts(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, n: r.drink_id && r.food_id ? counts.get(key(r.drink_id, r.food_id)) ?? 0 : 0, likes: likes.get(r.id) ?? 0 }));
}

/* ---------- 하트 ---------- */

/** 내가 하트 누른 글 id */
export async function myLikes(userId: string): Promise<number[]> {
  const sb = db();
  if (!sb) return [];
  const { data } = await sb.from("member_pick_likes").select("pick_id").eq("user_id", userId).limit(5000);
  return ((data ?? []) as { pick_id: number }[]).map((r) => r.pick_id);
}

/** 내 글 id — 목록에서 "(나)" 표시·내 글 하트 막기 */
export async function myPostIds(userId: string): Promise<number[]> {
  const sb = db();
  if (!sb) return [];
  const { data } = await sb.from("member_picks").select("id").eq("user_id", userId).limit(500);
  return ((data ?? []) as { id: number }[]).map((r) => r.id);
}

/** 하트 토글 — 내 글에는 못 누른다. 결과의 likes는 토글 뒤 수 */
export async function toggleLike(userId: string, pickId: number): Promise<{ ok: true; liked: boolean; likes: number; published: boolean } | { ok: false; error: string; code: number }> {
  const sb = need();
  const { data: p } = await sb.from("member_picks").select("id,user_id,drink_id,food_id,status").eq("id", pickId).maybeSingle();
  if (!p || p.status !== "active" || !p.drink_id || !p.food_id) return { ok: false, error: "글을 찾을 수 없어요", code: 404 };
  if (p.user_id === userId) return { ok: false, error: "내 글에는 하트를 누를 수 없어요", code: 400 };
  const { count: has } = await sb.from("member_pick_likes").select("pick_id", { count: "exact", head: true }).eq("pick_id", pickId).eq("user_id", userId);
  let liked: boolean;
  if (has) { await sb.from("member_pick_likes").delete().eq("pick_id", pickId).eq("user_id", userId); liked = false; }
  else { const { error } = await sb.from("member_pick_likes").insert({ pick_id: pickId, user_id: userId }); if (error && error.code !== "23505") throw new Error(error.message); liked = true; }
  const { count } = await sb.from("member_pick_likes").select("pick_id", { count: "exact", head: true }).eq("pick_id", pickId);
  const r = liked ? await syncPair(p.drink_id, p.food_id) : { created: false };
  // 활동 소식 푸시(docs/25 §7) — 글쓴이에게 "○○님이 하트", 설정이 켜져 있을 때만
  if (liked) {
    const { data: liker } = await sb.from("users").select("name").eq("id", userId).maybeSingle();
    await getCatalog();
    await activityPush(String(p.user_id), likePush(String(liker?.name || "회원"), D[p.drink_id]?.name ?? p.drink_id, F[p.food_id]?.name ?? p.food_id));
  }
  return { ok: true, liked, likes: count ?? 0, published: r.created };
}

/* ---------- 만들기 ---------- */

export type CreateInput = { drinkId?: string | null; foodId?: string | null; drinkRaw?: string | null; foodRaw?: string | null; note: string; imageUrl?: string | null };
export type CreateResult = { ok: true; status: MemberPickStatus; n: number; published: boolean } | { ok: false; error: string; code?: number };

export async function createPick(userId: string, input: CreateInput): Promise<CreateResult> {
  const sb = need();
  await getCatalog();
  const drinkId = input.drinkId && D[input.drinkId] ? input.drinkId : null;
  const foodId = input.foodId && F[input.foodId] ? input.foodId : null;
  const drinkRaw = drinkId ? null : (input.drinkRaw || "").trim().slice(0, 40) || null;
  const foodRaw = foodId ? null : (input.foodRaw || "").trim().slice(0, 40) || null;
  if (!drinkId && !drinkRaw) return { ok: false, error: "술을 골라 주세요" };
  if (!foodId && !foodRaw) return { ok: false, error: "음식을 골라 주세요" };

  const since = new Date(Date.now() - 86400000).toISOString();
  const { count: today } = await sb.from("member_picks").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((today ?? 0) >= MEMBER_PICK_DAILY) return { ok: false, error: `추천은 하루 ${MEMBER_PICK_DAILY}건까지예요`, code: 429 };

  if (drinkId && foodId) {
    const { count: dup } = await sb.from("member_picks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("drink_id", drinkId).eq("food_id", foodId);
    if (dup) return { ok: false, error: "이미 추천한 조합이에요", code: 409 };
  }
  const status: MemberPickStatus = drinkId && foodId ? "active" : "review";
  const { error } = await sb.from("member_picks").insert({ user_id: userId, drink_id: drinkId, food_id: foodId, drink_raw: drinkRaw, food_raw: foodRaw, note: input.note.trim(), image_url: input.imageUrl ?? null, status });
  if (error?.code === "23503") return { ok: false, error: "회원 정보를 찾을 수 없어요. 다시 로그인해 주세요", code: 401 };   // 탈퇴한 계정의 남은 세션
  if (error) throw new Error(error.message);
  try { revalidatePath("/"); revalidatePath("/picks"); } catch { /* 라우트 핸들러 밖 */ }
  if (status !== "active") return { ok: true, status, n: 0, published: false };
  const r = await syncPair(drinkId!, foodId!);
  return { ok: true, status, n: r.n, published: r.created || r.exists };
}

/** 조합의 글 수·최다 하트를 보고, 조건이 되면 pairings에 회원픽 행을 만든다(이미 있으면 그대로). 화면 캐시도 비운다 */
export async function syncPair(drinkId: string, foodId: string): Promise<{ n: number; created: boolean; exists: boolean }> {
  const sb = need();
  const { data } = await sb.from("member_picks").select("*,users!member_picks_user_id_fkey(name)").eq("status", "active").eq("drink_id", drinkId).eq("food_id", foodId).order("created_at");
  const rows = (data ?? []) as PickRow[];
  const n = rows.length;
  const likes = await likeCounts(rows.map((r) => r.id));
  const maxLikes = Math.max(0, ...rows.map((r) => likes.get(r.id) ?? 0));
  let created = false, exists = false;
  if (n && memberPickPublishes(n, maxLikes)) {
    const { data: existing } = await sb.from("pairings").select("id").eq("drink_id", drinkId).eq("food_id", foodId).maybeSingle();
    exists = !!existing;
    if (!existing) {
      await getCatalog();
      const d = D[drinkId], f = F[foodId];
      const pf = d?.profile && f?.profile ? profileFit(d.profile, d.abv ?? null, f.profile) : { s: 40, plus: [], minus: [] };
      const reason = `페어링GO 회원 ${n}명이 직접 추천한 조합입니다. 한 줄 이유는 카드 아래에 닉네임과 함께 보여 드려요.`;
      // 대중 언급 수 — 어드민 승격과 같은 규칙(네이버 블로그 결과 수). 키가 없으면 0, 나중에 blog-counts 스크립트가 채운다
      const blogCount = d && f ? await countPairBlog({ name: d.name, alias: d.alias ?? null }, { name: f.name }).catch(() => null) : null;
      const { data: p, error } = await sb.from("pairings").insert({ drink_id: drinkId, food_id: foodId, expert_score: MEMBER_PICK_ES, reason, blog_count: blogCount ?? 0, source_tier: "user", status: "curated", profile_score: pf }).select("id").single();
      if (error || !p) throw new Error(error?.message ?? "페어링 생성 실패");
      await sb.from("pairing_evidence").insert(rows.map((r) => ({ pairing_id: p.id, source: "회원 추천", url: null, quote: r.note ? r.note.slice(0, 120) : null, who: nickOf(r), tier: "user" })));
      created = true;
      // 카탈로그 버전을 올려 다른 프로세스(다른 페이지·Vercel 함수)의 캐시도 15초 안에 새로 받게 한다. 스냅샷은 어드민 발행 때만
      const version = new Date().toISOString();
      await sb.from("catalog_meta").upsert({ key: "version", value: version, updated_at: version });
      invalidateCatalog();
      try {
        // 상세 화면은 ISR(10분) — 새 회원픽 카드가 바로 보이게 술·음식 상세 전체를 다시 그리게 한다(개별 한글 경로 지정은 실측에서 지워지지 않았다)
        revalidatePath("/"); revalidatePath("/picks");
        revalidatePath("/drinks/[slug]", "page"); revalidatePath("/foods/[slug]", "page");
      } catch (e) { console.warn("[member-picks] revalidate 실패", (e as Error).message); }
    }
  }
  return { n, created, exists };
}

/* ---------- 사진 ---------- */

const BUCKET = "member-picks";
/** 사진 1장 → Supabase Storage 공개 URL. 형식·크기는 여기서 검사한다 */
export async function uploadPickImage(userId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const sb = need();
  if (!(MEMBER_IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: "JPG·PNG·WebP 사진만 올릴 수 있어요" };
  if (file.size > MEMBER_IMAGE_MAX_BYTES) return { ok: false, error: "사진은 3MB까지예요" };
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  let { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
  if (error && /not found|bucket/i.test(error.message)) {
    await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MEMBER_IMAGE_MAX_BYTES, allowedMimeTypes: [...MEMBER_IMAGE_TYPES] }).catch(() => null);
    ({ error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false }));
  }
  if (error) return { ok: false, error: "사진을 올리지 못했어요" };
  return { ok: true, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

/* ---------- 어드민 ---------- */

export async function listReviewPicks(): Promise<PickRow[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb.from("member_picks").select("*,users!member_picks_user_id_fkey(name)").in("status", ["review", "hidden"]).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as PickRow[];
}

/** 검수: 술·음식을 지정해 게시(active) — 둘 다 카탈로그 id여야 한다 */
export async function resolvePick(id: number, drinkId: string, foodId: string, note: string) {
  const sb = need();
  await getCatalog();
  if (!D[drinkId] || !F[foodId]) throw new Error("없는 술 또는 음식");
  const { data: r } = await sb.from("member_picks").select("user_id").eq("id", id).single();
  if (!r) throw new Error("추천을 찾을 수 없어요");
  const { count: dup } = await sb.from("member_picks").select("id", { count: "exact", head: true }).eq("user_id", r.user_id).eq("drink_id", drinkId).eq("food_id", foodId).neq("id", id);
  if (dup) { await sb.from("member_picks").update({ status: "hidden", review_note: "같은 회원의 같은 조합이 이미 있음" }).eq("id", id); return { n: 0 }; }
  const { error } = await sb.from("member_picks").update({ drink_id: drinkId, food_id: foodId, status: "active", review_note: note || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  try { revalidatePath("/"); revalidatePath("/picks"); } catch { /* */ }
  return syncPair(drinkId, foodId);
}

export async function hidePick(id: number, note: string) {
  const sb = need();
  const { error } = await sb.from("member_picks").update({ status: "hidden", review_note: note || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  try { revalidatePath("/"); revalidatePath("/picks"); } catch { /* */ }
}
