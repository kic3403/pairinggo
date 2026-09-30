/**
 * 운영 지표 세기(2026-10-01) — 고른 기간과 바로 앞 같은 길이 기간을 같은 기준으로 센다. 어드민 대시보드와 주간 리포트 이메일이 같이 쓴다.
 * 기간 규칙(1·7·30일 탭, 직접 선택)과 표시 규칙은 shared ops-metrics.ts. 기간마다 10분 기억(같은 서버 인스턴스 안).
 */
import { demographics, opsPeriod, prevPeriod, type Demographics, type OpsPeriod, type WeeklyCounts, type WeeklyMetrics } from "@pairinggo/shared";
import { db } from "./db";

type Sb = NonNullable<ReturnType<typeof db>>;
const memo = new Map<string, { at: number; val: { metrics: WeeklyMetrics; demo: Demographics; period: OpsPeriod } }>();

/** 방문 세션 수 — PostgREST는 한 번에 1,000행까지라 끝까지 나눠 받는다(30일·직접 선택이면 수천 행) */
async function distinctSessions(sb: Sb, from: string, to: string): Promise<number> {
  const seen = new Set<string>();
  for (let off = 0; off < 200_000; off += 1000) {
    const { data, error } = await sb.from("events").select("session_id").eq("name", "screen").gte("created_at", from).lt("created_at", to).order("id").range(off, off + 999);
    if (error || !data?.length) break;
    for (const r of data as { session_id: string | null }[]) if (r.session_id) seen.add(r.session_id);
    if (data.length < 1000) break;
  }
  return seen.size;
}

async function countIn(sb: Sb, from: string, to: string): Promise<WeeklyCounts> {
  const head = { count: "exact" as const, head: true };
  const c = async (q: PromiseLike<{ count: number | null }>) => { try { return (await q).count ?? 0; } catch { return 0; } };
  const between = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(q: T) => q.gte("created_at", from).lt("created_at", to);
  const [visits, visitors, searches, emptySearches, saves, newUsers, picks, placeReviews, drinkReviews, expertReviews, reservations, orders] = await Promise.all([
    c(between(sb.from("events").select("id", head).eq("name", "screen"))),
    distinctSessions(sb, from, to).catch(() => 0),
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
  return { visits, visitors, searches, emptySearches, saves, newUsers, picks, reviews: placeReviews + drinkReviews, expertReviews, reservations, orders };
}

/** sp = 주소 값({ p } 또는 { from, to }). 없으면 최근 7일 */
export async function opsMetrics(sp: { p?: unknown; from?: unknown; to?: unknown } = {}): Promise<{ metrics: WeeklyMetrics; demo: Demographics; period: OpsPeriod }> {
  const now = new Date();
  const period = opsPeriod(sp, now);
  const key = period.key === "custom" ? `c:${period.from}:${period.to}` : `p:${period.key}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.val;
  const prev = prevPeriod(period);
  const zero: WeeklyCounts = { visits: 0, visitors: 0, searches: 0, emptySearches: 0, saves: 0, newUsers: 0, picks: 0, reviews: 0, expertReviews: 0, reservations: 0, orders: 0 };
  const sb = db();
  if (!sb) return { metrics: { cur: zero, prev: zero, since: period.since, until: period.until }, demo: demographics([]), period };
  const [cur, before, users] = await Promise.all([
    countIn(sb, period.since, period.until), countIn(sb, prev.since, prev.until),
    sb.from("users").select("gender,birth_date,sido").limit(5000).then((r) => (r.data ?? []) as { gender: string | null; birth_date: string | null; sido: string | null }[], () => []),
  ]);
  const val = { metrics: { cur, prev: before, since: period.since, until: period.until }, demo: demographics(users, now), period };
  memo.set(key, { at: Date.now(), val });
  if (memo.size > 50) memo.delete(memo.keys().next().value!);
  return val;
}
