/**
 * 공개 웹 퍼널 이벤트 — 미니앱 analytics.ts와 같은 이름·속성으로 /api/v1/events 에 보낸다.
 * 이벤트: screen · search(서버에서 search_logs 직접) · buy_link_click · restaurant_link_click · external_link · save · restaurant_list · card_tap · rate(먹어봤어요 평가) · share(method: kakao|native|copy)
 * 링크 클릭은 sendBeacon으로 보내 새 탭으로 넘어가도 유실되지 않는다. 실패는 조용히 버린다(분석 데이터가 화면을 막으면 안 된다).
 * buy_link_click의 d/f 는 refresh_pairing_feedback(0004)이 집계 키로 쓴다 — 술 id는 반드시 d 로.
 */
export type WebEventName = "screen" | "buy_link_click" | "restaurant_link_click" | "external_link" | "save" | "restaurant_list" | "card_tap" | "rate" | "member_pick" | "pick_like" | "share" | "reserve_click" | "reserve_submit" | "reserve_confirmed" | "reserve_cancel" | "reserve_fail" | "suggest_click" | "place_detail" | "review_submit" | "review_report" | "cart_add" | "order_submit" | "order_done" | "order_cancel";
type Props = Record<string, string | number | boolean | null>;

const KEY = "pg_sid";
function sid(): string {
  try {
    let v = window.sessionStorage.getItem(KEY);
    if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); window.sessionStorage.setItem(KEY, v); }
    return v;
  } catch { return "anon"; }
}

export function track(name: WebEventName, props: Props = {}) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ events: [{ n: name, p: { ...props, sid: sid(), src: "web", path: window.location.pathname.slice(0, 120) }, t: Date.now() }] });
    if (navigator.sendBeacon) { navigator.sendBeacon("/api/v1/events", new Blob([body], { type: "application/json" })); return; }
    void fetch("/api/v1/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* 무시 */ }
}
