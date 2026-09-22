/**
 * GET /api/cron/mentions — 매일 00:00(KST) 채널별 언급량을 세고 "많이 찾는 전통주" 순위를 다시 매긴다.
 *   Vercel Cron(vercel.json: 0 15 * * * UTC = 00:00 KST), Authorization: Bearer CRON_SECRET
 *   ?channel=naver,youtube  일부 채널만 · ?all=1  회전 무시하고 전부(첫 실행·복구용) · ?dry=1  저장하지 않고 결과만
 *   ?probe=1  밖으로 나가지 않고 키·수집 상태만(할당량 소모 없음) · ?probe=1&test=1  술 한 종으로 채널당 1회만 시험
 * 흐름: 수집 → drink_mentions_daily 저장 → 최근 기록(LOOKBACK일)으로 점수·순위(shared trend.ts) → drinks.trend·catalog_meta.trend_meta 갱신
 *       → 상위 20 순서가 바뀌었으면 카탈로그 발행(앱도 다음 실행 때 받는다).
 */
import { MENTION_CHANNELS, attachRankDelta, lastCountedDay, pickByStaleness, scoreMentions, trendNote, type Drink, type MentionChannel, type MentionRow } from "@pairinggo/shared";
import { publish } from "@/lib/admin-data";
import { getCatalog, invalidateCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { error, json, NO_CACHE } from "@/lib/http";
import { channelEnabled, collectChannel, probeChannel, todayKst, WINDOW_DAYS, type Collected } from "@/lib/mentions";

export const runtime = "nodejs";
export const maxDuration = 300;   // 네이버 최대 1,000여 회 + 유튜브·구글 50여 회. 보통 1~2분

/**
 * 점수에 쓰는 창 — 회전 한 바퀴(518종 ÷ 하루 상한 ≈ 7일)보다 넉넉해야
 * 술마다 "마지막으로 센 값"이 창 안에 남아 채널 평균에 들어간다(2026-09-22).
 */
const LOOKBACK = 12;
/**
 * 하루에 셀 수 있는 술 수 — 무료 할당량 안쪽으로 잡는다.
 *  · youtube 검색 1회 = 100유닛, 하루 10,000유닛. 한 술당 1~2쪽(실측 평균 1.2쪽) → 75종이 안전선
 *  · google  Programmable Search 무료 100회/일, 한 술당 1회 → 90종
 *  · naver   호출 수 제한이 넉넉해 매일 전량
 */
const DAILY_CAP: Partial<Record<MentionChannel, number>> = { youtube: 75, google: 90 };

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
  // 한 번에 1,000행까지만 오므로 끝까지 받아 온다 — 자르면 점수도 회전 대상도 옛 기록으로 계산된다(2026-09-22)
  const prevRows: MentionRow[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb.from("drink_mentions_daily").select("day,drink_id,channel,count").gte("day", since).order("day").order("drink_id").range(from, from + 999);
    if (page.error) return error(req, 500, page.error.message);
    prevRows.push(...(page.data || []).map((r) => ({ day: String(r.day), drinkId: r.drink_id, channel: r.channel as MentionChannel, count: r.count })));
    if (!page.data || page.data.length < 1000) break;
    if (from > 200_000) { log.push("기록이 너무 많아 일부만 읽었습니다"); break; }
  }

  /** 오늘 셀 술 — 할당량이 있는 채널은 **가장 오래 세지 않은 것부터** 상한만큼(shared pickByStaleness) */
  const targets = (ch: MentionChannel): Drink[] => {
    const cap = DAILY_CAP[ch];
    if (all || !cap) return drinks;
    const pick = new Set(pickByStaleness(drinks.map((d) => d.id), lastCountedDay(prevRows, ch), cap));
    return drinks.filter((d) => pick.has(d.id));
  };

  // 진단(?probe=1) — 밖으로 한 번도 나가지 않고 키 설정과 최근 수집 상태만 돌려준다(할당량을 쓰지 않는다)
  if (url.searchParams.get("probe") === "1") {
    const state = Object.fromEntries(MENTION_CHANNELS.map((ch) => {
      const last = lastCountedDay(prevRows, ch);
      const days = [...last.values()].sort();
      return [ch, {
        key: ch === "insta" ? "수동 입력" : channelEnabled(ch) ? "있음" : "없음",
        dailyCap: DAILY_CAP[ch] ?? null,
        countedDrinks: last.size,
        ofDrinks: drinks.length,
        lastDay: days[days.length - 1] ?? null,
        oldestDay: days[0] ?? null,
        roundDays: DAILY_CAP[ch] ? Math.ceil(drinks.length / DAILY_CAP[ch]!) : 1,
      }];
    }));
    // &test=1 — 키가 진짜 통하는지 술 한 종으로만 시험(채널당 호출 1회, 그날 크론에 지장 없음)
    let test: Record<string, unknown> | undefined;
    if (url.searchParams.get("test") === "1" && drinks.length) {
      const which = (only ?? MENTION_CHANNELS).filter((ch) => ch !== "insta" && channelEnabled(ch));
      test = Object.fromEntries(await Promise.all(which.map(async (ch) => [ch, await probeChannel(ch, drinks[0], today)])));
    }
    return json(req, { ok: true, probe: true, today, lookback: LOOKBACK, channels: state, test }, { headers: NO_CACHE });
  }

  // 수집 — 채널을 순서대로(각 채널 안에서는 동시 6개)
  const collected: Collected[] = [];
  const summary: Record<string, { drinks: number; skipped?: string }> = {};
  for (const ch of MENTION_CHANNELS) {
    if (only && !only.includes(ch)) continue;
    if (ch === "insta") { summary[ch] = { drinks: 0, skipped: "수동 입력 채널" }; continue; }
    if (!channelEnabled(ch)) { summary[ch] = { drinks: 0, skipped: "키 없음" }; continue; }
    const pick = targets(ch);
    if (DAILY_CAP[ch] && !all) log.push(`${ch}: 오래 안 센 순 ${pick.length}종 (전체 ${drinks.length}종 → ${Math.ceil(drinks.length / DAILY_CAP[ch]!)}일에 한 바퀴)`);
    const rows = await collectChannel(ch, pick, today, log);
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
