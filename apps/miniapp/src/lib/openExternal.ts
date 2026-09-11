/**
 * 외부 링크는 반드시 여기로. (CLAUDE.md 절대 규칙)
 * 토스 앱 안에서는 SDK Device.openURL로 기기 브라우저를 열고, 일반 브라우저(AIT Devtools·미리보기)에서는 window.open.
 * 허용되는 외부 이동: 법적 고지 · 제휴기관 공식 페이지 · "제품 추천 후 구매 플랫폼 이동" (앱인토스 정책 예외)
 *
 * 두 가지가 중요하다.
 *  1) 토스 밖에서는 await를 거치면 사용자 제스처(transient activation)가 풀려 팝업 차단에 걸린다.
 *     그래서 환경을 **먼저** 판별하고 window.open을 동기로 호출한다.
 *  2) 실제로 열렸을 때만 buy_link_click 같은 퍼널 이벤트를 남긴다. 실패는 link_open_failed로 따로 센다.
 *     이 수치는 양조장 입점 제안 자료이자 pairing_feedback 집계에 들어가므로 부풀리면 안 된다.
 */
import { Device } from "@apps-in-toss/web-framework";
import { track, type EventName } from "./analytics";
import { inToss } from "./location";
import { toast } from "./prefs";

export type ExternalKind = "buy" | "map" | "evidence" | "tel" | "legal" | "other";

const EVENT: Record<ExternalKind, EventName> = {
  buy: "buy_link_click", map: "restaurant_link_click",
  evidence: "external_link", tel: "external_link", legal: "external_link", other: "external_link",
};

/** 새 탭으로 열고 실제로 열렸는지 돌려준다. noopener를 옵션으로 주면 성공해도 null이 와서 판별이 안 되므로 opener를 직접 끊는다 */
function openTab(url: string): boolean {
  try {
    const w = window.open(url, "_blank");
    if (!w) return false;
    try { w.opener = null; } catch { /* 교차 출처면 이미 분리돼 있다 */ }
    return true;
  } catch { return false; }
}

/** @returns 링크가 실제로 열렸는지 */
export async function openExternal(url: string, kind: ExternalKind = "other", meta?: Record<string, string | number>): Promise<boolean> {
  if (!url) return false;
  const done = (ok: boolean, via: string) => {
    if (ok) track(EVENT[kind], { url, kind, via, ...meta });
    else {
      track("link_open_failed", { url, kind, via, ...meta });
      toast("링크를 열 수 없어요. 잠시 후 다시 시도해 주세요");
    }
    return ok;
  };

  if (url.startsWith("tel:")) { window.location.href = url; return done(true, "tel"); }

  // 토스 밖: await 전에 동기로 열어야 팝업 차단을 피한다
  if (!inToss()) return done(openTab(url), "window");

  try {
    await Device.openURL(url);
    return done(true, "toss");
  } catch {
    // 토스 안에서 SDK가 실패한 경우 — 제스처는 이미 풀렸지만 웹뷰에서 열릴 수 있으므로 시도해 본다
    return done(openTab(url), "toss_fallback");
  }
}
