"use client";
/**
 * 공유용 그림 카드 받기(2026-10-01) — 인스타·블로그에 올릴 1080×1350 그림을 기기에 저장한다.
 * 그림은 우리 사이트 주소(`/today/card.png`·`/report/card.png`)라 외부 링크가 아니다. 누른 것은 share 이벤트(channel "card")로 남긴다.
 */
import { track } from "@/lib/track";

export default function CardDownload({ href, filename, from, label = "그림 카드 저장", className = "btn" }: { href: string; filename: string; from: string; label?: string; className?: string }) {
  return <a className={className} href={href} download={filename} onClick={() => track("share", { channel: "card", from })}>{label}</a>;
}
