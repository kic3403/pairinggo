/**
 * 요즘 핫한 페어링 조합 — 최근 30일 우리 앱 사용자의 행동(페어링 카드 탭·저장·구매 클릭·식당 찾기)에서 술+음식 조합을 세어 순위.
 * events.props 에 d(술 id)와 f(음식 id)가 함께 있는 이벤트만 조합으로 친다(미니앱 card_tap의 from/to 형식도 받는다).
 * 아직 데이터가 적으면 근거가 확인된 조합을 어울림 점수 순으로 채우고(2026-09-27 새 점수식) 그 사실을 화면에 적는다.
 */
import { confidenceOf, pairingScore, type Dataset, type Pairing } from "@pairinggo/shared";
import { db } from "./db";

export type HotPair = { pairing: Pairing; score: number; taps: number; saves: number; buys: number; places: number; fromLogs: boolean };
const WEIGHT: Record<string, number> = { card_tap: 1, save: 3, buy_link_click: 3, restaurant_link_click: 2 };
const NAMES = Object.keys(WEIGHT);

function pairOf(name: string, p: Record<string, unknown>): { d: string; f: string } | null {
  let d = typeof p.d === "string" ? p.d : null, f = typeof p.f === "string" ? p.f : null;
  // 미니앱 card_tap: from "drink:d01" → to "food:f02"
  for (const k of ["from", "to"]) { const v = p[k]; if (typeof v === "string") { if (v.startsWith("drink:")) d ??= v.slice(6); if (v.startsWith("food:")) f ??= v.slice(5); } }
  return d && f ? { d, f } : null;
}

// 최근 30일 이벤트(최대 5,000행)를 매번 읽으면 화면이 1초 넘게 걸려 10분 동안 기억한다(2026-09-30). 카탈로그가 바뀌면 새로 센다
let memo: { key: string; at: number; val: { list: HotPair[]; logged: number; since: string } } | null = null;
const MEMO_MS = 10 * 60 * 1000;

export async function hotPairs(ds: Dataset, n = 12, days = 30): Promise<{ list: HotPair[]; logged: number; since: string }> {
  const key = `${n}|${days}|${ds.pairings.length}|${ds.drinks.length}`;
  if (memo && memo.key === key && Date.now() - memo.at < MEMO_MS) return memo.val;
  const val = await computeHot(ds, n, days);
  memo = { key, at: Date.now(), val };
  return val;
}

async function computeHot(ds: Dataset, n: number, days: number): Promise<{ list: HotPair[]; logged: number; since: string }> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const byKey = new Map<string, HotPair>();
  const pairMap = new Map(ds.pairings.map((p) => [`${p.d}|${p.f}`, p]));
  const sb = db();
  if (sb) {
    const { data } = await sb.from("events").select("name,props").gte("created_at", since).in("name", NAMES).order("id", { ascending: false }).limit(5000);
    for (const e of data || []) {
      const pr = pairOf(e.name, (e.props || {}) as Record<string, unknown>);
      if (!pr) continue;
      const key = `${pr.d}|${pr.f}`;
      const pairing = pairMap.get(key);
      if (!pairing) continue;
      const h = byKey.get(key) ?? { pairing, score: 0, taps: 0, saves: 0, buys: 0, places: 0, fromLogs: true };
      h.score += WEIGHT[e.name] ?? 1;
      if (e.name === "card_tap") h.taps++; else if (e.name === "save") h.saves++; else if (e.name === "buy_link_click") h.buys++; else h.places++;
      byKey.set(key, h);
    }
  }
  const list = [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, n);
  const logged = list.length;
  if (list.length < n) {
    const used = new Set(list.map((h) => `${h.pairing.d}|${h.pairing.f}`));
    const fill = [...ds.pairings].filter((p) => !used.has(`${p.d}|${p.f}`) && confidenceOf(p) === "confirmed")
      .sort((a, b) => pairingScore(b) - pairingScore(a) || b.blog - a.blog).slice(0, n - list.length);
    for (const p of fill) list.push({ pairing: p, score: 0, taps: 0, saves: 0, buys: 0, places: 0, fromLogs: false });
  }
  return { list, logged, since };
}
