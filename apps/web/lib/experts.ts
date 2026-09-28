/**
 * 전문가 검수(2026-09-28, docs/27) — 신청·상태·검수 대기열(회원 쪽)과 승인·반려·정지(어드민). 판정 저장은 packages/server/expert-reviews.ts.
 *  · 증빙 사진은 비공개 버킷 expert-docs/{userId}/… — 회원 API는 경로를 절대 내보내지 않고, 어드민만 10분짜리 서명 주소로 본다
 *  · 승인·정지·재개·탈퇴 때는 그 전문가 판정이 걸린 조합의 expert_yes/no를 다시 센다(정지된 전문가는 배지에서 빠진다)
 */
import { revalidatePath } from "next/cache";
import {
  EXPERT_DOCS_MAX, MEMBER_IMAGE_MAX_BYTES, MEMBER_IMAGE_TYPES, cleanCompensation, cleanExpertApplication, cleanExpertStatus, confidenceOf, expertApplicationProblem, expertDisplayName, expertPush,
  kindOf, scorePairings, type DrinkKind, type ExpertCompensation, type ExpertStatus, type GradeKey, type Pairing,
} from "@pairinggo/shared";
import { recountExpertFor, renameExpertEvidence } from "@pairinggo/server/expert-reviews";
import { getCatalog, invalidateCatalog } from "./catalog";
import { db } from "./db";
import { activityPush } from "./push-digest";
import { sameOrigin, userIdOf } from "./session-uid";

const BUCKET = "expert-docs";
const need = () => { const sb = db(); if (!sb) throw new Error("DB가 연결되지 않았어요"); return sb; };
const str = (v: unknown) => String(v ?? "");

export type ExpertRow = {
  userId: string; status: ExpertStatus; realName: string; affiliation: string; title: string; displayName: string; intro: string; docsCount: number; docPaths: string[];
  compensation: ExpertCompensation; publicConsentAt: string; appliedAt: string; approvedAt: string | null; rejectReason: string; reviewsCount: number; nick: string | null; email: string | null;
};
type Row = Record<string, unknown>;
const toRow = (r: Row): ExpertRow => {
  const u = (r.users as Row | null) ?? null;
  return {
    userId: str(r.user_id), status: cleanExpertStatus(r.status), realName: str(r.real_name), affiliation: str(r.affiliation), title: str(r.title), displayName: str(r.display_name), intro: str(r.intro),
    docPaths: Array.isArray(r.doc_paths) ? (r.doc_paths as string[]) : [], docsCount: Array.isArray(r.doc_paths) ? (r.doc_paths as string[]).length : 0,
    compensation: cleanCompensation(r.compensation), publicConsentAt: str(r.public_consent_at), appliedAt: str(r.applied_at), approvedAt: (r.approved_at as string | null) ?? null,
    rejectReason: str(r.reject_reason), reviewsCount: Number(r.reviews_count) || 0, nick: (u?.name as string | null) ?? null, email: (u?.email as string | null) ?? null,
  };
};

/** 회원 화면용 — 증빙 경로는 개수만 */
export async function getExpert(userId: string): Promise<Omit<ExpertRow, "docPaths"> | null> {
  const sb = db();
  if (!sb) return null;
  const { data } = await sb.from("experts").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const { docPaths: _d, ...rest } = toRow(data as Row);
  void _d;
  return rest;
}

export async function expertStatusOf(userId: string): Promise<ExpertStatus | null> {
  const sb = db();
  if (!sb) return null;
  const { data } = await sb.from("experts").select("status").eq("user_id", userId).maybeSingle();
  return data ? cleanExpertStatus(data.status) : null;
}

async function uploadExpertDoc(userId: string, file: File): Promise<string> {
  const sb = need();
  if (!(MEMBER_IMAGE_TYPES as readonly string[]).includes(file.type)) throw new Error("증빙은 JPG·PNG·WebP 사진만 올릴 수 있어요");
  if (file.size > MEMBER_IMAGE_MAX_BYTES) throw new Error("사진은 3MB까지예요");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const put = () => sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
  let { error } = await put();
  if (error && /not found|bucket/i.test(error.message)) {
    await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MEMBER_IMAGE_MAX_BYTES, allowedMimeTypes: [...MEMBER_IMAGE_TYPES] }).catch(() => null);
    ({ error } = await put());
  }
  if (error) throw new Error("증빙 사진을 올리지 못했어요 — 잠시 뒤 다시 시도해 주세요");
  return path;
}

/** 신청(또는 반려 뒤 다시 신청) — 승인·정지 상태에서는 거부 */
export async function applyExpert(userId: string, raw: Record<string, unknown>, docs: File[], publicConsent: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = need();
  const input = cleanExpertApplication(raw);
  const problem = expertApplicationProblem({ ...input, docsCount: docs.length, publicConsent });
  if (problem) return { ok: false, error: problem };
  const cur = await getExpert(userId);
  if (cur?.status === "approved") return { ok: false, error: "이미 전문가로 승인된 계정이에요" };
  if (cur?.status === "suspended") return { ok: false, error: "정지된 계정은 다시 신청할 수 없어요 — 문의해 주세요" };
  if (cur?.status === "applied") return { ok: false, error: "이미 심사 중이에요 — 결과를 기다려 주세요" };
  const paths: string[] = [];
  try { for (const f of docs.slice(0, EXPERT_DOCS_MAX)) if (f.size > 0) paths.push(await uploadExpertDoc(userId, f)); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  const now = new Date().toISOString();
  const { error } = await sb.from("experts").upsert({
    user_id: userId, status: "applied", real_name: input.realName, affiliation: input.affiliation, title: input.title, display_name: expertDisplayName(input.realName, input.affiliation, input.title),
    intro: input.intro, doc_paths: paths, public_consent_at: now, applied_at: now, approved_at: null, reject_reason: "", updated_at: now,
  }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "신청을 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  return { ok: true };
}

/** 전문가 API 문지기 — 로그인 + 같은 출처 + 승인 상태 */
export async function requireExpert(req: Request): Promise<{ userId: string; displayName: string } | Response> {
  const json = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(req)) return json("허용되지 않은 요청", 403);
  const uid = await userIdOf(req);
  if (!uid) return json("로그인이 필요해요", 401);
  const sb = db();
  if (!sb) return json("DB 미설정", 503);
  const { data } = await sb.from("experts").select("status,display_name").eq("user_id", uid).maybeSingle();
  if (!data || cleanExpertStatus(data.status) !== "approved") return json("승인된 전문가만 검수할 수 있어요", 403);
  return { userId: uid, displayName: str(data.display_name) };
}

export type QueueItem = { d: string; f: string; drink: string; drinkSub: string; food: string; foodSub: string; kind: DrinkKind; grade: GradeKey; xp: { yes: number; no: number } | null; quote: string | null; who: string | null; source: string | null; reason: string };

/**
 * 검수 대기열 — 이 전문가가 아직 판정하지 않은 공개 조합을 ① 어울림 1명(배지 문턱 직전) ② 근거 확인인데 전문가 검수 없음 ③ 추정(맛 분석 점수순) 순으로.
 */
export async function expertQueue(userId: string, opts: { kind?: string | null; offset?: number; limit?: number } = {}): Promise<{ items: QueueItem[]; total: number }> {
  const sb = db();
  const c = await getCatalog();
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d])), F = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const done = new Set<string>();
  if (sb) { const { data } = await sb.from("expert_reviews").select("drink_id,food_id").eq("user_id", userId); for (const r of data ?? []) done.add(`${r.drink_id}|${r.food_id}`); }
  const scored = new Map(scorePairings(c.dataset.pairings, (p) => D.get(p.d)?.category || "").map((s) => [`${s.p.d}|${s.p.f}`, s]));
  const pool = c.dataset.pairings.filter((p) => !done.has(`${p.d}|${p.f}`) && D.has(p.d) && F.has(p.f) && (!opts.kind || kindOf(D.get(p.d)!) === opts.kind));
  const rank = (p: Pairing) => {
    const yes = p.xp?.yes ?? 0;
    if (yes >= 1 && yes < 2) return 0;
    if (!p.xp && confidenceOf(p) === "confirmed") return 1;
    return 2;
  };
  pool.sort((a, b) => rank(a) - rank(b) || (b.xp?.yes ?? 0) - (a.xp?.yes ?? 0) || (b.pf?.s ?? 0) - (a.pf?.s ?? 0) || a.d.localeCompare(b.d));
  const offset = Math.max(0, opts.offset ?? 0), limit = Math.max(1, Math.min(60, opts.limit ?? 30));
  const items = pool.slice(offset, offset + limit).map((p): QueueItem => {
    const d = D.get(p.d)!, f = F.get(p.f)!;
    return {
      d: p.d, f: p.f, drink: d.name, drinkSub: [d.category, d.abv != null ? `${d.abv}%` : null, d.brewery].filter(Boolean).join(" · "), food: f.name, foodSub: [f.category, ...(f.tags ?? []).slice(0, 2)].join(" · "),
      kind: kindOf(d), grade: scored.get(`${p.d}|${p.f}`)?.grade.key ?? "try", xp: p.xp ?? null,
      quote: p.ev?.quote ?? null, who: p.ev?.who ?? null, source: p.ev?.source ?? null, reason: (p.reason ?? "").slice(0, 120),
    };
  });
  return { items, total: pool.length };
}

/* ---------- 어드민 ---------- */

export async function listExperts(): Promise<ExpertRow[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb.from("experts").select("*,users!experts_user_id_fkey(name,email)").order("applied_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  const order: Record<ExpertStatus, number> = { applied: 0, suspended: 1, approved: 2, rejected: 3 };
  return ((data ?? []) as Row[]).map(toRow).sort((a, b) => order[a.status] - order[b.status]);
}

/** 어드민만 — 증빙 사진 10분짜리 서명 주소(실패한 장은 null) */
export async function docSignedUrls(paths: string[]): Promise<(string | null)[]> {
  const sb = db();
  if (!sb || !paths.length) return paths.map(() => null);
  return Promise.all(paths.map(async (p) => { const { data } = await sb.storage.from(BUCKET).createSignedUrl(p, 600).catch(() => ({ data: null })); return data?.signedUrl ?? null; }));
}

export type ExpertAction = "approve" | "reject" | "suspend" | "resume";
const NEXT: Record<ExpertAction, { from: ExpertStatus[]; to: ExpertStatus; needsReason: boolean }> = {
  approve: { from: ["applied", "rejected"], to: "approved", needsReason: false },
  reject: { from: ["applied"], to: "rejected", needsReason: true },
  suspend: { from: ["approved"], to: "suspended", needsReason: true },
  resume: { from: ["suspended"], to: "approved", needsReason: false },
};

export async function actOnExpert(userId: string, action: ExpertAction, reason: string, displayName?: string): Promise<void> {
  const sb = need();
  const rule = NEXT[action];
  if (!rule) throw new Error("알 수 없는 처리예요");
  const why = str(reason).replace(/\s+/g, " ").trim().slice(0, 200);
  if (rule.needsReason && !why) throw new Error("사유를 적어 주세요 — 회원 알림에 보여요");
  const { data: cur } = await sb.from("experts").select("status,display_name").eq("user_id", userId).maybeSingle();
  if (!cur) throw new Error("전문가를 찾을 수 없어요");
  const status = cleanExpertStatus(cur.status);
  if (!rule.from.includes(status)) throw new Error(`지금 상태(${status})에서는 할 수 없는 처리예요`);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: rule.to, reject_reason: rule.needsReason ? why : "", updated_at: now };
  const newName = str(displayName).replace(/\s+/g, " ").trim().slice(0, 60);
  if (action === "approve") { patch.approved_at = now; if (newName) patch.display_name = newName; }
  const { error } = await sb.from("experts").update(patch).eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (newName && newName !== str(cur.display_name)) await renameExpertEvidence(str(cur.display_name), newName);
  // 승인·정지·재개 → 배지 집계 다시(정지된 전문가 판정은 빠진다)
  const n = await recountExpertFor(userId).catch(() => 0);
  if (n) { invalidateCatalog(); revalidatePath("/drinks/[slug]", "page"); revalidatePath("/foods/[slug]", "page"); }
  if (action !== "resume") await activityPush(userId, expertPush(rule.to as "approved" | "rejected" | "suspended", why));
}

/** 승인된 전문가의 표시명만 바꾸기 — 근거 줄의 이름도 함께 */
export async function renameExpert(userId: string, displayName: string): Promise<void> {
  const sb = need();
  const newName = str(displayName).replace(/\s+/g, " ").trim().slice(0, 60);
  if (newName.length < 2) throw new Error("표시명을 2자 이상 적어 주세요");
  const { data: cur } = await sb.from("experts").select("display_name").eq("user_id", userId).maybeSingle();
  if (!cur) throw new Error("전문가를 찾을 수 없어요");
  const { error } = await sb.from("experts").update({ display_name: newName, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw new Error(error.message);
  await renameExpertEvidence(str(cur.display_name), newName);
  invalidateCatalog();
}

/** 대시보드 — 심사 대기 수 */
export async function pendingExpertCount(): Promise<number> {
  const sb = db();
  if (!sb) return 0;
  const { count } = await sb.from("experts").select("user_id", { count: "exact", head: true }).eq("status", "applied");
  return count ?? 0;
}

/** 탈퇴 — 증빙 파일 삭제(판정 되돌리기는 removeAllExpertReviews) */
export async function removeExpertDocs(userId: string): Promise<void> {
  const sb = db();
  if (!sb) return;
  const { data: files } = await sb.storage.from(BUCKET).list(userId, { limit: 100 }).catch(() => ({ data: null }));
  if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${userId}/${f.name}`)).catch(() => null);
}
