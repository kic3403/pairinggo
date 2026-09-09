/**
 * 퍼널 이벤트 — 앱인토스 Analytics SDK + 로컬 링버퍼(500건).
 * Phase 2에서 서버(events 테이블)로 배치 전송한다. 개인정보는 넣지 않는다.
 * 이벤트: search · search_intent · search_empty · card_tap · buy_link_click · restaurant_link_click · external_link · save · browse · screen
 */
import { Analytics } from "@apps-in-toss/web-framework";

export type EventName =
  | "search" | "search_intent" | "search_empty" | "card_tap" | "buy_link_click" | "restaurant_link_click"
  | "external_link" | "save" | "screen" | "browse";

type Props = Record<string, string | number | boolean | null | undefined>;
type StoredEvent = { n: EventName; p: Props; t: number };

const KEY = "pgo_events";
const MAX = 500;
let session = "";
function sid() {
  if (!session) session = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return session;
}

function push(e: StoredEvent) {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: StoredEvent[] = raw ? JSON.parse(raw) : [];
    arr.push(e);
    if (arr.length > MAX) arr.splice(0, arr.length - MAX);
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch { /* 저장 불가 환경 무시 */ }
}

/** SDK 호출은 토스 앱 밖에서 실패할 수 있으므로 항상 조용히 삼킨다 */
function quiet(run: () => Promise<void> | undefined) {
  try { const p = run(); if (p) p.catch(() => {}); } catch { /* noop */ }
}
const strParams = (props: Props) =>
  Object.fromEntries(Object.entries(props).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));

export function track(name: EventName, props: Props = {}) {
  push({ n: name, p: { ...props, sid: sid() }, t: Date.now() });
  type LogParams = Parameters<typeof Analytics.log>[0];
  quiet(() => Analytics.log({ log_name: name, log_type: "event", params: strParams(props) } as unknown as LogParams));
}

export function screen(name: string, props: Props = {}) {
  track("screen", { name, ...props });
  type ScreenParams = Parameters<typeof Analytics.screen>[0];
  quiet(() => Analytics.screen({ log_name: name } as unknown as ScreenParams));
}

/** 로컬에 쌓인 이벤트 (Phase 2 서버 전송·디버그용) */
export function drainEvents(): StoredEvent[] {
  try { const raw = localStorage.getItem(KEY); localStorage.removeItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
