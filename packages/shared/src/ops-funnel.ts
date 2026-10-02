/**
 * 방문 흐름 지표(2026-10-02) — 어드민 대시보드 "방문 흐름" 칸. 방문 → 상세 조회 → 행동(저장·구매 링크·식당 링크·공유)을 **세션 수**로 센다.
 * 화면 조회 수나 클릭 수가 아니라 "몇 명(세션)이 다음 단계로 갔나"를 보려는 것 — 한 사람이 열 번 눌러도 한 번.
 * 숫자 세기(DB에서 이벤트 받기)는 웹 lib/ops-metrics.ts, 여기는 이벤트 줄 → 흐름 계산만.
 */

import { TRAFFIC_GROUP_LABEL, trafficSource, type TrafficGroup } from "./traffic-source";

/** 흐름 계산에 쓰는 이벤트 이름 — 웹이 이 이름들만 받아 온다 */
export const FUNNEL_EVENTS = ["screen", "save", "buy_link_click", "restaurant_link_click", "share", "situation_click"] as const;
export type FunnelEventRow = { name: string; session_id: string | null; props: Record<string, unknown> | null };

export type OpsFunnel = {
  /** 단계별 세션 수 */
  sessions: number;        // 화면을 하나라도 본 세션
  detailSessions: number;  // 술·음식 상세를 본 세션
  actionSessions: number;  // 저장·구매 링크·식당 링크·공유 중 하나라도 한 세션
  /** 행동별 횟수 */
  saves: number; guestSaves: number;   // guestSaves는 saves 안의 비로그인 기기 저장
  buyClicks: number; restaurantClicks: number;
  shares: number; cardSaves: number;   // cardSaves는 shares 안의 그림 카드 저장(channel card)
  /** 유입용 화면 조회 수 */
  guideViews: number; todayViews: number;
  /** 많이 본 상세 5개(조회 수) — 주소는 디코드한 값 */
  topDetails: { path: string; n: number }[];
  /** 유입 경로(2026-10-02) — 세션마다 하나: 그 세션의 화면 기록 가운데 처음 나온 바깥 유입(검색·SNS·공유·다른 사이트), 없으면 직접. 많은 순 */
  sources: { group: TrafficGroup; label: string; n: number }[];
  /** "오늘 같은 날엔" 칸·모음 링크 클릭 수(situation_click, docs/29) · 날씨 소식 푸시로 들어온 세션(utm_source=push) */
  situationClicks: number; pushSessions: number;
  /** 날씨 소식 발송 요약(크론 기록 catalog_meta weather_push에서, 기간 안) — 없으면 키 없음 */
  weatherPush?: { days: number; sent: number };
};

const ACTIONS = new Set(["save", "buy_link_click", "restaurant_link_click", "share"]);
const pathOf = (p: Record<string, unknown> | null) => {
  const v = typeof p?.path === "string" ? p.path : "";
  try { return decodeURIComponent(v); } catch { return v; }
};
/** 술·음식 상세 주소인지 — `/drinks/이름`·`/foods/이름`(목록·`/all`·분류 화면은 아님) */
export const isDetailPath = (path: string) => /^\/(drinks|foods)\/[^/]+$/.test(path) && path !== "/drinks/categories";

export function opsFunnel(rows: FunnelEventRow[]): OpsFunnel {
  const all = new Set<string>(), detail = new Set<string>(), action = new Set<string>();
  const f: OpsFunnel = { sessions: 0, detailSessions: 0, actionSessions: 0, saves: 0, guestSaves: 0, buyClicks: 0, restaurantClicks: 0, shares: 0, cardSaves: 0, guideViews: 0, todayViews: 0, topDetails: [], sources: [], situationClicks: 0, pushSessions: 0 };
  const views = new Map<string, number>();
  const srcOf = new Map<string, { group: TrafficGroup; label: string }>();   // 세션 → 바깥 유입(처음 것)
  for (const r of rows) {
    const sid = r.session_id || "";
    const path = pathOf(r.props);
    if (r.name === "screen") {
      if (sid) all.add(sid);
      if (sid && !srcOf.has(sid)) { const s = trafficSource(r.props ?? {}); if (s.group !== "internal" && s.group !== "direct") srcOf.set(sid, s); }
      if (isDetailPath(path)) { if (sid) detail.add(sid); views.set(path, (views.get(path) ?? 0) + 1); }
      else if (path === "/guide" || path.startsWith("/guide/")) f.guideViews++;
      else if (path === "/today") f.todayViews++;
      continue;
    }
    if (r.name === "situation_click") { f.situationClicks++; continue; }
    if (!ACTIONS.has(r.name)) continue;
    if (sid) action.add(sid);
    if (r.name === "save") { f.saves++; if (r.props?.guest === true || r.props?.guest === "true") f.guestSaves++; }
    else if (r.name === "buy_link_click") f.buyClicks++;
    else if (r.name === "restaurant_link_click") f.restaurantClicks++;
    else if (r.name === "share") { f.shares++; if (r.props?.channel === "card") f.cardSaves++; }
  }
  f.sessions = all.size; f.detailSessions = detail.size; f.actionSessions = action.size;
  const tally = new Map<string, { group: TrafficGroup; label: string; n: number }>();
  for (const sid of all) {
    const s = srcOf.get(sid) ?? { group: "direct" as const, label: TRAFFIC_GROUP_LABEL.direct };
    const k = `${s.group}|${s.label}`;
    const cur = tally.get(k) ?? { ...s, n: 0 };
    cur.n++; tally.set(k, cur);
  }
  f.sources = [...tally.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "ko"));
  f.pushSessions = f.sources.filter((s) => s.group === "push").reduce((a, s) => a + s.n, 0);
  f.topDetails = [...views].map(([path, n]) => ({ path, n })).sort((a, b) => b.n - a.n || a.path.localeCompare(b.path, "ko")).slice(0, 5);
  return f;
}

/** 단계 비율 문구 — "12% (3/25)". 분모가 0이면 "—" */
export function stepRate(n: number, of: number): string {
  if (!of) return "—";
  return `${Math.round((n / of) * 100)}% (${n}/${of})`;
}

/** 날씨 소식 크론 기록 한 줄(web lib/push-digest recordWeatherRun이 catalog_meta weather_push에 최근 60일 쌓는다) */
export type WeatherRunLog = { at: string; users: number; sent: number; sidos: Record<string, string> };
/** 기간 안의 날씨 소식 발송 요약 — 보낸 날 수(sent>0인 날)·보낸 회원 수 합 */
export function summarizeWeatherRuns(runs: readonly WeatherRunLog[], since: string, until: string): { days: number; sent: number } {
  let days = 0, sent = 0;
  const seen = new Set<string>();
  for (const r of runs) {
    if (!r.at || r.at < since || r.at >= until) continue;
    const day = new Date(new Date(r.at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    if (r.sent > 0 && !seen.has(day)) { seen.add(day); days++; }
    sent += r.sent;
  }
  return { days, sent };
}
