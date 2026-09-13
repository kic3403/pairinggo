/**
 * GET /api/cron/mentions — 매일 00:00(KST) 채널별 언급량을 세고 "많이 찾는 전통주" 순위를 다시 매긴다.
 *   Vercel Cron(vercel.json: 0 15 * * * UTC = 00:00 KST), Authorization: Bearer CRON_SECRET
 *   ?channel=naver,youtube  일부 채널만 · ?all=1  회전 무시하고 전부(첫 실행·복구용) · ?dry=1  저장하지 않고 결과만
 * 흐름: 수집 → drink_mentions_daily 저장 → 최근 7일 기록으로 점수·순위(shared trend.ts) → drinks.trend·catalog_meta.trend_meta 갱신
 *       → 상위 20 순서가 바뀌었으면 카탈로그 발행(앱도 다음 실행 때 받는다).
 */
import { MENTION_CHANNELS, attachRankDelta, scoreMentions, trendNote, type Drink, type MentionChannel, type MentionRow } from "@pairinggo/shared";
import { publish } from "@/lib/admin-data";
import { getCatalog, invalidateCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { error, json, NO_CACHE } from "@/lib/http";
import { channelEnabled, collectChannel, todayKst, WINDOW_DAYS, type Collected } from "@/lib/mentions";

export const runtime = "nodejs";
export const maxDuration = 300;   // 네이버 최대 1,000여 회 + 유튜브·구글 50여 회. 보통 1~2분

const LOOKBACK = 7;
/** 유튜브·구글은 무료 할당량(검색 100회/일) 때문에 하루 절반씩 — 짝수일 앞 절반, 홀수일 뒤 절반 */
const ROTATED: MentionChannel[] = ["youtube", "google"];

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error(req, 401, "권한 없음");
  const sb = db();
  if (!sb) return json(req, { ok: false, reason: "DB 미설정" }, { status: 202, headers: NO_CACHE });

  const url = new URL(req.url);
  const only = url.searchParams.get("channel")?.split(",").filter((c): c is MentionChannel => (MENTION_CHANNELS as readonly string[]).includes(c));
  const all = url.searchParams.get("all") === "1";
  const dry = url.searchParams.get("dry") === "1";
  const today = todayKst();
  const startedAt = Date.now();
  const log: string[] = [];

  const c = await getCatalog();
  if (c.source !== "db") return json(req, { ok: false, reason: "DB 카탈로그가 아님" }, { status: 202, headers: NO_CACHE });
  const drinks = c.dataset.drinks.filter((d) => !d.generic);   // 일반 명사와 겹치는 이름은 세지 않는다

  // 최근 기록 — 회전 대상 고르기(backfill)와 점수 계산에 함께 쓴다
  // 급상승 비교용으로 일주일 전 기준 창(7+LOOKBACK일)까지 받는다
  const weekAgo = new Date(Date.parse(today + "T00:00:00Z") - 7 * 86400000).toISOString().slice(0, 10);
  const since = new Date(Date.parse(today + "T00:00:00Z") - (7 + LOOKBACK) * 86400000).toISOString().slice(0, 10);
  const prev = await sb.from("drink_mentions_daily").select("day,drink_id,channel,count").gte("day", since);
  if (prev.error) return error(req, 500, prev.error.message);
  const prevRows: MentionRow[] = (prev.data || []).map((r) => ({ day: String(r.day), drinkId: r.drink_id, channel: r.channel as MentionChannel, count: r.count }));
  const hasRecent = (id: string, ch: MentionChannel, days: number) => prevRows.some((r) => r.drinkId === id && r.channel === ch && r.day > new Date(Date.parse(today + "T00:00:00Z") - days * 86400000).toISOString().slice(0, 10));

  const dayIndex = Math.floor(Date.parse(today + "T00:00:00Z") / 86400000);
  const targets = (ch: MentionChannel): Drink[] => {
    if (all || !ROTATED.includes(ch)) return drinks;
    const half = drinks.filter((_, i) => i % 2 === dayIndex % 2);
    const backfill = drinks.filter((d) => !half.includes(d) && !hasRecent(d.id, ch, LOOKBACK));
    return [...half, ...backfill];
  };

  // 수집 — 채널을 순서대로(각 채널 안에서는 동시 6개)
  const collected: Collected[] = [];
  const summary: Record<string, { drinks: number; skipped?: string }> = {};
  for (const ch of MENTION_CHANNELS) {
    if (only && !only.includes(ch)) continue;
    if (ch === "insta") { summary[ch] = { drinks: 0, skipped: "수동 입력 채널" }; continue; }
    if (!channelEnabled(ch)) { summary[ch] = { drinks: 0, skipped: "키 없음" }; continue; }
    const rows = await collectChannel(ch, targets(ch), today, log);
    collected.push(...rows);
    summary[ch] = { drinks: rows.length };
    // 상한에 걸린 술은 검색어가 일반 단어와 겹칠 가능성이 크다 — 로그로 드러내 QUERY_OVERRIDE 후보로 삼는다
    const capped = rows.filter((r) => r.capped).map((r) => `${c.dataset.drinks.find((d) => d.id === r.drinkId)?.name}(${r.query}=${r.count})`);
    if (capped.length) log.push(`${ch} 상한 도달: ${capped.join(", ")}`);
  }

  // 저장
  if (!dry && collected.length) {
    const up = await sb.from("drink_mentions_daily").upsert(
      collected.map((r) => ({ day: today, drink_id: r.drinkId, channel: r.channel, count: r.count, window_days: WINDOW_DAYS, capped: r.capped, query: r.query, raw: r.raw ?? null })),
      { onConflict: "day,drink_id,channel" },
    );
    if (up.error) return error(req, 500, `저장 실패: ${up.error.message}`);
  }

  // 점수·순위 — 오늘 수집분 + 최근 기록
  const rows: MentionRow[] = [...prevRows.filter((r) => r.day !== today || !collected.some((x) => x.drinkId === r.drinkId && x.channel === r.channel)), ...collected.map((r) => ({ day: today, drinkId: r.drinkId, channel: r.channel, count: r.count }))];
  const res = scoreMentions(rows, { today, lookbackDays: LOOKBACK, drinkIds: drinks.map((d) => d.id) });
  // 일주일 전 순위(같은 규칙, 7일 전을 오늘로) → 급상승 ▲▼
  const prevRes = scoreMentions(prevRows, { today: weekAgo, lookbackDays: LOOKBACK, drinkIds: drinks.map((d) => d.id) });
  const compared = Object.values(prevRes.trend).some((t) => t.rank);
  res.trend = attachRankDelta(res.trend, compared ? prevRes.trend : {});
  const note = trendNote(res, today, WINDOW_DAYS);
  const ranked = Object.entries(res.trend).filter(([, t]) => t.rank).sort((a, b) => a[1].rank! - b[1].rank!);
  const top = ranked.slice(0, 20).map(([id, t]) => ({ id, name: c.dataset.drinks.find((d) => d.id === id)?.name, score: t.score, rank: t.rank, raw: t.raw }));

  if (dry) return json(req, { ok: true, dry: true, today, summary, channels: res.channels, top, note, log, ms: Date.now() - startedAt }, { headers: NO_CACHE });

  // drinks.trend 갱신(집계 안 한 술은 null — 순위에서 빠진다)
  const before = c.dataset.drinks.filter((d) => d.trend?.rank).sort((a, b) => a.trend!.rank! - b.trend!.rank!).slice(0, 20).map((d) => d.id).join(",");
  let failed = 0;
  const ids = c.dataset.drinks.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async (id) => {
      const t = res.trend[id];
      const { error: e } = await sb.from("drinks").update({ trend: t && t.channels ? t : null }).eq("id", id);
      if (e) { failed++; if (failed <= 3) log.push(`drinks.trend ${id}: ${e.message}`); }
    }));
  }
  const meta = await sb.from("catalog_meta").upsert({ key: "trend_meta", value: { period: `최근 ${WINDOW_DAYS}일`, collected: today, note, channels: res.channels, compared_to: compared ? weekAgo : null }, updated_at: new Date().toISOString() });
  if (meta.error) log.push(`trend_meta: ${meta.error.message}`);

  // 상위 20 순서가 바뀌었으면 발행 → 미니앱도 다음 실행 때 새 순위를 받는다
  invalidateCatalog();
  let published: string | null = null;
  const after = ranked.slice(0, 20).map(([id]) => id).join(",");
  if (after && after !== before && !failed) {
    try { published = (await publish(`일일 트렌드 갱신 ${today}`)).version; }
    catch (e) { log.push(`발행 실패: ${(e as Error).message}`); }
  }
  return json(req, { ok: failed === 0, today, summary, channels: res.channels, top: top.slice(0, 10), note, published, failed, log, ms: Date.now() - startedAt }, { headers: NO_CACHE });
}
