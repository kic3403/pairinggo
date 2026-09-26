/**
 * 재방문 알림(docs/25 §7) — 누구에게 무엇을 보낼지. 문구 규칙은 shared push-digest.ts, 발송은 packages/server/push.
 *  · activityPush: 회원의 활동 소식 설정(push_pref.activity)이 켜져 있을 때만 즉시 발송
 *  · weeklyRun: 알림을 켠 기기가 있는 회원마다 개인화한 주간 소식 한 건(6일 안에 두 번 안 보냄), 내용 없으면 건너뜀
 */
import { D, F, WEEKLY_LOOKBACK_DAYS, WEEKLY_MIN_GAP_DAYS, byDrink, byFood, cleanPushPref, scorePairings, suggestTried, toSlug, weeklyDigest, type DigestInput, type PushMessage, type PushPref } from "@pairinggo/shared";
import { pushConfigured, pushTo } from "@pairinggo/server/push";
import { getCatalog } from "./catalog";
import { db } from "./db";
import { myRatings } from "./ratings";

const EVIDENCE = ["official", "sommelier", "media", "user"];

export async function pushPrefOf(uid: string): Promise<PushPref> {
  const sb = db();
  if (!sb) return cleanPushPref(null);
  const { data } = await sb.from("users").select("push_pref").eq("id", uid).maybeSingle();
  return cleanPushPref(data?.push_pref);
}
export async function setPushPref(uid: string, raw: unknown): Promise<PushPref> {
  const sb = db(); if (!sb) throw new Error("Supabase 미설정");
  const pref = cleanPushPref(raw);
  const { error } = await sb.from("users").update({ push_pref: pref }).eq("id", uid);
  if (error) throw new Error(error.message);
  return pref;
}
export async function pushDeviceCount(uid: string): Promise<number> {
  const sb = db(); if (!sb) return 0;
  const { count } = await sb.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("owner_type", "user").eq("owner_id", uid);
  return count ?? 0;
}

/** 활동 소식 — 실패해도 호출한 쪽 흐름을 막지 않는다(기록만) */
export async function activityPush(uid: string, msg: PushMessage): Promise<void> {
  try {
    if (!pushConfigured()) return;
    if (!(await pushPrefOf(uid)).activity) return;
    await pushTo("user", uid, msg);
  } catch (e) { console.warn("[push] activity", (e as Error).message); }
}

/** 한 회원의 이번 주 소식 재료 */
export async function digestInputFor(uid: string, now = new Date()): Promise<DigestInput> {
  const sb = db(); const c = await getCatalog();
  const since = new Date(now.getTime() - WEEKLY_LOOKBACK_DAYS * 86400_000).toISOString();
  const empty: DigestInput = { savedNews: [], trendUp: [], unrated: 0, newDrinks: 0 };
  if (!sb) return empty;
  const { data: saved } = await sb.from("saved_items").select("kind,item_id").eq("user_id", uid).limit(500);
  const savedDrinks = (saved ?? []).filter((r) => r.kind === "drink").map((r) => String(r.item_id));
  const savedFoods = (saved ?? []).filter((r) => r.kind === "food").map((r) => String(r.item_id));
  const pairingsBy = new Map<string, number>(), productsBy = new Map<string, number>();
  if (savedDrinks.length) {
    const [{ data: pr }, { data: pd }] = await Promise.all([
      sb.from("pairings").select("drink_id").in("drink_id", savedDrinks).in("source_tier", EVIDENCE).gte("created_at", since).limit(2000),
      sb.from("products").select("drink_id").in("drink_id", savedDrinks).eq("status", "selling").gte("created_at", since).limit(2000),
    ]);
    for (const r of pr ?? []) pairingsBy.set(String(r.drink_id), (pairingsBy.get(String(r.drink_id)) ?? 0) + 1);
    for (const r of pd ?? []) productsBy.set(String(r.drink_id), (productsBy.get(String(r.drink_id)) ?? 0) + 1);
  }
  const savedNews = savedDrinks.map((id) => D[id]).filter(Boolean).map((d) => ({ name: d.name, slug: toSlug(d.name), pairings: pairingsBy.get(d.id) ?? 0, products: productsBy.get(d.id) ?? 0 })).filter((x) => x.pairings || x.products);
  const compared = !!c.dataset.trend_meta?.compared_to;
  const trendUp = compared ? c.dataset.drinks.filter((d) => d.trend?.rank && d.trend.rank <= 10 && (d.trend.prev_rank == null || (d.trend.delta ?? 0) >= 3)).sort((a, b) => (a.trend!.rank! - b.trend!.rank!)).slice(0, 3).map((d) => ({ name: d.name, slug: toSlug(d.name), delta: d.trend!.prev_rank == null ? null : d.trend!.delta ?? 0 })) : [];
  const rated = await myRatings(uid).catch(() => new Set<string>());
  const unrated = savedDrinks.length || savedFoods.length ? suggestTried({ savedDrinks, savedFoods, rated, byDrink, byFood, rank: (p) => scorePairings(p, (x) => D[x.d]?.category || "").map((s) => s.p) }).length : 0;
  const newDrinks = c.dataset.drinks.filter((d) => !d.demo && d.added && d.added >= since).length;
  return { savedNews, trendUp, unrated, newDrinks };
}

export type WeeklyRunResult = { users: number; sent: number; skipped: { pref: number; recent: number; empty: number; failed: number }; samples: { uid: string; body: string }[] };

/** 주간 소식 발송(월요일 아침 크론). dry면 보내지 않고 미리보기만 */
export async function weeklyRun(opts: { dry?: boolean; limit?: number; now?: Date } = {}): Promise<WeeklyRunResult> {
  const sb = db();
  const now = opts.now ?? new Date();
  const res: WeeklyRunResult = { users: 0, sent: 0, skipped: { pref: 0, recent: 0, empty: 0, failed: 0 }, samples: [] };
  if (!sb || (!opts.dry && !pushConfigured())) return res;
  const { data: subs } = await sb.from("push_subscriptions").select("owner_id").eq("owner_type", "user").limit(5000);
  const uids = [...new Set((subs ?? []).map((s) => String(s.owner_id)))].slice(0, opts.limit ?? 500);
  res.users = uids.length;
  if (!uids.length) return res;
  const { data: users } = await sb.from("users").select("id,push_pref,weekly_push_at").in("id", uids);
  const gap = now.getTime() - WEEKLY_MIN_GAP_DAYS * 86400_000;
  for (const u of users ?? []) {
    const uid = String(u.id);
    if (!cleanPushPref(u.push_pref).weekly) { res.skipped.pref++; continue; }
    if (u.weekly_push_at && new Date(String(u.weekly_push_at)).getTime() > gap) { res.skipped.recent++; continue; }
    const msg = weeklyDigest(await digestInputFor(uid, now));
    if (!msg) { res.skipped.empty++; continue; }
    if (res.samples.length < 5) res.samples.push({ uid: uid.slice(0, 8), body: msg.body });
    if (opts.dry) { res.sent++; continue; }
    const r = await pushTo("user", uid, msg);
    if (r.sent > 0) { res.sent++; await sb.from("users").update({ weekly_push_at: now.toISOString() }).eq("id", uid); }
    else res.skipped.failed++;
  }
  return res;
}
