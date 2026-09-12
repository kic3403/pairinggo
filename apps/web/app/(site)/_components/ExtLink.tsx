"use client";
/**
 * 외부 링크(새 탭) + 퍼널 이벤트. 공개 웹의 구매·쇼핑·지도·출처 링크는 모두 이걸로 연다(<a target=_blank> 직접 쓰지 않는다).
 * 일반 <a>라 검색엔진·가운데 클릭·길게 누르기가 그대로 되고, 클릭 순간 sendBeacon으로 이벤트를 남긴다.
 * 구매 링크: event="buy_link_click", props={ d: 술id, store, url } — 입점 제안 자료·refresh_pairing_feedback 입력.
 */
import type { ReactNode } from "react";
import { track, type WebEventName } from "@/lib/track";

type Props = { href: string; event: WebEventName; props?: Record<string, string | number | boolean | null>; className?: string; children: ReactNode; title?: string; style?: React.CSSProperties };

export default function ExtLink({ href, event, props, className, children, title, style }: Props) {
  return (
    <a href={href} target="_blank" rel="noopener nofollow" className={className} title={title} style={style} onClick={() => track(event, { url: href.slice(0, 300), ...(props || {}) })}>
      {children}
    </a>
  );
}
