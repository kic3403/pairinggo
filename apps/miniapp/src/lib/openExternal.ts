/**
 * 외부 링크는 반드시 여기로. (CLAUDE.md 절대 규칙)
 * 토스 앱 안에서는 SDK Device.openURL로 기기 브라우저를 열고, 일반 브라우저(AIT Devtools·미리보기)에서는 window.open.
 * 허용되는 외부 이동: 법적 고지 · 제휴기관 공식 페이지 · "제품 추천 후 구매 플랫폼 이동" (앱인토스 정책 예외)
 */
import { Device } from "@apps-in-toss/web-framework";
import { track } from "./analytics";

export type ExternalKind = "buy" | "map" | "evidence" | "tel" | "legal" | "other";

export async function openExternal(url: string, kind: ExternalKind = "other", meta?: Record<string, string | number>) {
  if (!url) return;
  track(kind === "buy" ? "buy_link_click" : kind === "map" ? "restaurant_link_click" : "external_link", { url, kind, ...meta });
  if (url.startsWith("tel:")) { window.location.href = url; return; }
  try {
    await Device.openURL(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
