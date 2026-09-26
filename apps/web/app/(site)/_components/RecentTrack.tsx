"use client";
/** 최근 본 기록(docs/25 §6) — 술·음식·매장 상세가 뜨면 기기의 localStorage에 넣는다. 서버로 보내지 않는다. 화면에는 아무것도 그리지 않는다 */
import { useEffect } from "react";
import { cleanRecent, pushRecent, type RecentKind } from "@pairinggo/shared/notifications";

export const RECENT_KEY = "pg_recent";

export default function RecentTrack({ kind, id, name, meta, href }: { kind: RecentKind; id: string; name: string; meta?: string; href: string }) {
  useEffect(() => {
    try {
      const cur = cleanRecent(JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]"));
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(cur, { kind, id, name, meta, href })));
      window.dispatchEvent(new Event("pg-recent"));
    } catch { /* 저장소를 못 쓰는 브라우저 — 기록 없이 지나간다 */ }
  }, [kind, id, name, meta, href]);
  return null;
}
