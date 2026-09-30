/**
 * 운영 지표 세기(2026-10-01) — 최근 7일과 그 전 7일을 같은 기준으로 센다. 어드민 대시보드와 주간 리포트 이메일이 같이 쓴다.
 * 규칙(나이대·줄임·증감 표시)은 shared ops-metrics.ts. 10분 기억(같은 서버 인스턴스 안).
 */
import { demographics, type Demographics, type WeeklyCounts, type WeeklyMetrics } from "@pairinggo/shared";
import { db } from "./db";

const DAY = 86400_000;
let memo: { at: number; val: { metrics: WeeklyMetrics; demo: Demographics } } | null = null;

async function countIn(sb: NonNullable<ReturnType<typeof db>>, from: string, to: string): Promise<WeeklyCounts> {
  const head = { count: "exact" as const, head: true };
  const c = async (q: PromiseLike<{ count: number | null }>) => { try { return (await q).count ?? 0; } catch { return 0; } };
  const between = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(q: T, col = "created_at") => q.gte(col, from).lt(col, to);
  const [visits, visitorRows, searches, emptySearches, saves, newUsers, picks, placeReviews, drinkReviews, expertReviews, reservations, orders] = await Promise.all([
    c(between(sb.from("events").select("id", head).eq("name", "screen"))),
    between(sb.from("events").select("session_id").eq("name", "screen")).limit(20000).then((r) => r.data ?? [], () => []),
    c(between(sb.from("search_logs").select("id", head).in("kind", ["search", "search_intent"]))),
    c(between(sb.from("search_logs").select("id", head).eq("kind", "search_empty"))),
    c(between(sb.from("events").select("id", head).eq("name", "save"))),
    c(between(sb.from("users").select("id", head))),
    c(between(sb.from("member_picks").select("id", head))),
    c(between(sb.from("place_reviews").select("id", head))),
    c(between(sb.from("drink_reviews").select("id", head))),
    c(between(sb.from("expert_reviews").select("id", head))),
    c(between(sb.from("reservations").select("id", head))),
    c(between(sb.from("orders").select("id", head))),
  ]);
  const visitors = new Set((visitorRows as { session_id: string | null }[]).map((r) => r.session_id).filter(Boolean)).size;
  return { visits, visitors, searches, emptySearches, saves, newUsers, picks, reviews: placeReviews + drinkReviews, expertReviews, reservations, orders };
}

export async function opsMetrics(): Promise<{ metrics: WeeklyMetrics; demo: Demographics }> {
  if (memo && Date.now() - memo.at < 10 * 60 * 1000) return memo.val;
  const sb = db();
  const now = new Date();
  const until = now.toISOString(), since = new Date(now.getTime() - 7 * DAY).toISOString(), before = new Date(now.getTime() - 14 * DAY).toISOString();
  const zero: WeeklyCounts = { visits: 0, visitors: 0, searches: 0, emptySearches: 0, saves: 0, newUsers: 0, picks: 0, reviews: 0, expertReviews: 0, reservations: 0, orders: 0 };
  if (!sb) return { metrics: { cur: zero, prev: zero, since, until }, demo: demographics([]) };
  const [cur, prev, users] = await Promise.all([
    countIn(sb, since, until), countIn(sb, before, since),
    sb.from("users").select("gender,birth_date,sido").limit(5000).then((r) => (r.data ?? []) as { gender: string | null; birth_date: string | null; sido: string | null }[], () => []),
  ]);
  const val = { metrics: { cur, prev, since, until }, demo: demographics(users, now) };
  memo = { at: Date.now(), val };
  return val;
}
