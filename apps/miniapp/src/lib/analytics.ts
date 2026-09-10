/**
 * 퍼널 이벤트 — 앱인토스 Analytics SDK + 로컬 큐(500건) → 서버 배치 전송(POST /api/v1/events).
 * 전송 시점: 30초마다 · 화면이 숨겨질 때 · 큐 50건. 실패하면 큐를 유지한다. 개인정보는 넣지 않는다.
 * 이벤트: search · search_intent · search_empty · card_tap · buy_link_click · restaurant_link_click · external_link · save · browse · screen
 */
import { Analytics } from "@apps-in-toss/web-framework";
import { apiEnabled, fetchJson } from "./api";

export type EventName =
  | "search" | "search_intent" | "search_empty" | "card_tap" | "buy_link_click" | "restaurant_link_click"
  | "external_link" | "save" | "screen" | "browse" | "restaurant_list";

type Props = Record<string, string | number | boolean | null | undefined>;
type StoredEvent = { n: EventName; p: Props; t: number };

const KEY = "pgo_events";
const MAX = 500;
const FLUSH_AT = 50;
const FLUSH_MS = 30_000;
let session = "";
function sid() {
  if (!session) session = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return session;
}

function readQueue(): StoredEvent[] {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function writeQueue(arr: StoredEvent[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX))); } catch { /* 저장 불가 환경 무시 */ }
}
function push(e: StoredEvent) {
  const arr = readQueue(); arr.push(e); writeQueue(arr);
  if (arr.length >= FLUSH_AT) void flush();
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
  track("screen", { path: name, ...props });
  type ScreenParams = Parameters<typeof Analytics.screen>[0];
  quiet(() => Analytics.screen({ log_name: name } as unknown as ScreenParams));
}

let flushing = false;
/** 큐를 서버로 보낸다. 서버 미설정이면 아무것도 안 함(큐는 500건에서 순환) */
export async function flush() {
  if (!apiEnabled() || flushing) return;
  const batch = readQueue().slice(0, 100);
  if (!batch.length) return;
  flushing = true;
  try {
    const r = await fetchJson<{ accepted: number }>("/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: batch }), timeoutMs: 6000 });
    // 성공(200/202) 또는 서버가 형식 오류로 거부(4xx)한 배치는 큐에서 뺀다 — 거부된 배치를 남기면 영원히 재시도한다. 네트워크·5xx만 유지
    if (r.ok || (r.status >= 400 && r.status < 500)) writeQueue(readQueue().slice(batch.length));
  } finally { flushing = false; }
}

let timer: number | null = null;
/** App 시작 시 1회: 주기 전송 + 화면 숨김 시 전송 */
export function startAnalyticsFlush() {
  if (timer != null || !apiEnabled()) return;
  timer = window.setInterval(() => void flush(), FLUSH_MS);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(); });
  void flush();
}

/** 로컬에 쌓인 이벤트 비우기 (마이 화면 초기화용) */
export function drainEvents(): StoredEvent[] {
  const arr = readQueue(); try { localStorage.removeItem(KEY); } catch { /* noop */ } return arr;
}
