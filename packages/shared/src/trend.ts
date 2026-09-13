/**
 * "요즘 많이 찾는 전통주" 점수 — 채널별 최근 30일 언급량을 0~100으로 맞춘 뒤 평균.
 *
 * 규칙(2026-09-12 확정):
 *  - 채널 4개: 인스타그램 · 유튜브 · 네이버 블로그 · 구글(블로그). 채널마다 언급 수가 가장 많은 술이 100점, 나머지는 비례.
 *  - 술의 점수 = 값이 있는 채널의 평균. 예) 인스타 100·네이버 50·구글 50·유튜브 50 → 75.
 *  - 언급 0건은 0점(값 있음). 그 채널을 아예 세지 못한 술만 null(평균에서 제외). 채널을 한 번도 세지 않았으면 전체가 null.
 *  - 술마다 채널별 **가장 최근** 기록(lookbackDays 안)을 쓴다. 유튜브·구글은 할당량 때문에 하루에 절반씩 갱신하므로 하루이틀 전 값이 섞인다.
 *  - 순위는 점수 내림차순, 같으면 언급 총량이 많은 쪽이 위.
 */
import type { Trend } from "./types";

export const MENTION_CHANNELS = ["insta", "youtube", "naver", "google"] as const;
export type MentionChannel = (typeof MENTION_CHANNELS)[number];
export const CHANNEL_LABEL: Record<MentionChannel, string> = { insta: "인스타그램", youtube: "유튜브", naver: "네이버 블로그", google: "구글 블로그" };

export type MentionRow = { drinkId: string; channel: MentionChannel; count: number; day: string /* YYYY-MM-DD */ };

export type TrendResult = {
  trend: Record<string, Trend>;
  /** 채널별 최댓값(=100점 기준)과 집계된 술 수 — 설명 문구용 */
  channels: Record<MentionChannel, { max: number; drinks: number; top: string | null }>;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 날짜 문자열(YYYY-MM-DD) 차이(일) */
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);

export function scoreMentions(rows: MentionRow[], opts: { today: string; lookbackDays?: number; drinkIds?: string[] }): TrendResult {
  const lookback = opts.lookbackDays ?? 7;
  // 술×채널별 가장 최근 값
  const latest = new Map<string, Map<MentionChannel, MentionRow>>();
  for (const r of rows) {
    const age = dayDiff(opts.today, r.day);
    if (age < 0 || age > lookback) continue;
    const m = latest.get(r.drinkId) ?? new Map<MentionChannel, MentionRow>();
    const cur = m.get(r.channel);
    if (!cur || cur.day < r.day) m.set(r.channel, r);
    latest.set(r.drinkId, m);
  }
  const ids = opts.drinkIds ?? [...latest.keys()];

  // 채널별 최댓값
  const channels = Object.fromEntries(MENTION_CHANNELS.map((c) => [c, { max: 0, drinks: 0, top: null as string | null }])) as TrendResult["channels"];
  for (const id of ids) {
    const m = latest.get(id); if (!m) continue;
    for (const [c, r] of m) {
      channels[c].drinks++;
      if (r.count > channels[c].max) { channels[c].max = r.count; channels[c].top = id; }
    }
  }

  const trend: Record<string, Trend> = {};
  const scored: { id: string; score: number; total: number }[] = [];
  for (const id of ids) {
    const m = latest.get(id);
    const norm = (c: MentionChannel): number | null => {
      const r = m?.get(c); if (!r) return null;
      return channels[c].max > 0 ? round1((r.count / channels[c].max) * 100) : 0;
    };
    const vals = { insta: norm("insta"), youtube: norm("youtube"), naver: norm("naver"), google: norm("google") };
    const present = MENTION_CHANNELS.map((c) => vals[c]).filter((v): v is number => v !== null);
    const score = present.length ? round1(present.reduce((a, b) => a + b, 0) / present.length) : 0;
    const raw = Object.fromEntries(MENTION_CHANNELS.map((c) => [c, m?.get(c)?.count ?? null])) as Record<string, number | null>;
    trend[id] = { ...vals, score, channels: present.length, raw };
    if (present.length) scored.push({ id, score, total: MENTION_CHANNELS.reduce((s, c) => s + (m?.get(c)?.count ?? 0), 0) });
  }
  scored.sort((a, b) => b.score - a.score || b.total - a.total || a.id.localeCompare(b.id));
  scored.forEach((s, i) => { trend[s.id].rank = i + 1; });
  return { trend, channels };
}

/* ---------- 언급 판정 ---------- */
const DRINK_WORD = /막걸리|소주|약주|청주|탁주|증류|리큐르|와인|과실주|브랜디|미드|꿀술|생주|명주|법주|국화주|이화주|송주|배주|강주|홍로|력고|기술|리술|명주|춘$|주$/;
export const DRINK_CONTEXT = /술|주류|막걸리|소주|약주|청주|전통주|양조|증류|리큐르|와인|한잔|한 잔|안주|시음|주점|바틀|보틀|도수|음주|마셨|마시/;
const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 검색 결과 한 건이 "이 술 이야기"인지 — 제목+본문에 술 이름(또는 별칭)이 있어야 하고,
 * 이름 자체에 술 단어가 없으면("화요", "예담", "니모메") 술 맥락 단어가 함께 있어야 한다. 요일·사람 이름과 겹치는 글을 거른다.
 */
export function isDrinkMention(text: string, terms: string[]): boolean {
  const t = squash(text);
  const hit = terms.map(squash).filter(Boolean).find((k) => t.includes(k));
  if (!hit) return false;
  if (terms.some((k) => DRINK_WORD.test(k))) return true;
  return DRINK_CONTEXT.test(text);
}

/** 설명 문구 — 어떤 채널이 반영됐는지, 기준 기간 */
export function trendNote(res: TrendResult, today: string, windowDays = 30): string {
  const used = MENTION_CHANNELS.filter((c) => res.channels[c].drinks > 0).map((c) => CHANNEL_LABEL[c]);
  const from = new Date(Date.parse(today + "T00:00:00Z") - (windowDays - 1) * 86400000).toISOString().slice(0, 10);
  return `최근 ${windowDays}일(${from.slice(5).replace("-", "/")}~${today.slice(5).replace("-", "/")}) ${used.join("·")} 언급량 — 채널별 최다 언급을 100점으로 맞춰 평균. 매일 00:00 갱신.`;
}
