/**
 * 방문 흐름 지표(2026-10-02) — 어드민 대시보드 "방문 흐름" 칸. 방문 → 상세 조회 → 행동(저장·구매 링크·식당 링크·공유)을 **세션 수**로 센다.
 * 화면 조회 수나 클릭 수가 아니라 "몇 명(세션)이 다음 단계로 갔나"를 보려는 것 — 한 사람이 열 번 눌러도 한 번.
 * 숫자 세기(DB에서 이벤트 받기)는 웹 lib/ops-metrics.ts, 여기는 이벤트 줄 → 흐름 계산만.
 */

/** 흐름 계산에 쓰는 이벤트 이름 — 웹이 이 이름들만 받아 온다 */
export const FUNNEL_EVENTS = ["screen", "save", "buy_link_click", "restaurant_link_click", "share"] as const;
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
  const f: OpsFunnel = { sessions: 0, detailSessions: 0, actionSessions: 0, saves: 0, guestSaves: 0, buyClicks: 0, restaurantClicks: 0, shares: 0, cardSaves: 0, guideViews: 0, todayViews: 0, topDetails: [] };
  const views = new Map<string, number>();
  for (const r of rows) {
    const sid = r.session_id || "";
    const path = pathOf(r.props);
    if (r.name === "screen") {
      if (sid) all.add(sid);
      if (isDetailPath(path)) { if (sid) detail.add(sid); views.set(path, (views.get(path) ?? 0) + 1); }
      else if (path === "/guide" || path.startsWith("/guide/")) f.guideViews++;
      else if (path === "/today") f.todayViews++;
      continue;
    }
    if (!ACTIONS.has(r.name)) continue;
    if (sid) action.add(sid);
    if (r.name === "save") { f.saves++; if (r.props?.guest === true || r.props?.guest === "true") f.guestSaves++; }
    else if (r.name === "buy_link_click") f.buyClicks++;
    else if (r.name === "restaurant_link_click") f.restaurantClicks++;
    else if (r.name === "share") { f.shares++; if (r.props?.channel === "card") f.cardSaves++; }
  }
  f.sessions = all.size; f.detailSessions = detail.size; f.actionSessions = action.size;
  f.topDetails = [...views].map(([path, n]) => ({ path, n })).sort((a, b) => b.n - a.n || a.path.localeCompare(b.path, "ko")).slice(0, 5);
  return f;
}

/** 단계 비율 문구 — "12% (3/25)". 분모가 0이면 "—" */
export function stepRate(n: number, of: number): string {
  if (!of) return "—";
  return `${Math.round((n / of) * 100)}% (${n}/${of})`;
}
