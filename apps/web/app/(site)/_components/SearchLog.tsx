"use client";
/**
 * 검색 로그 — 검색 결과 화면이 뜨면 미니앱과 같은 이벤트(search·search_intent·search_empty)를 보낸다.
 * /api/v1/events 가 이 셋을 search_logs 로도 넣는다(pick "drink:d01" → matched). 서버에서 직접 넣지 않는 이유:
 * 관심지역이 있으면 /search?q= 가 곧바로 ?region= 으로 다시 열려 같은 검색이 두 번 찍힌다 → 같은 검색어는 60초 안에 한 번만.
 */
import { useEffect } from "react";
import { track, type WebEventName } from "@/lib/track";

type Props = { q: string; kind: "search" | "search_intent" | "search_empty"; pick?: string | null; region?: string | null; hits: number };

export default function SearchLog({ q, kind, pick, region, hits }: Props) {
  useEffect(() => {
    if (!q) return;
    try {
      const last = JSON.parse(window.sessionStorage.getItem("pg_lastq") || "null") as { q: string; t: number } | null;
      if (last && last.q === q && Date.now() - last.t < 60_000) return;
      window.sessionStorage.setItem("pg_lastq", JSON.stringify({ q, t: Date.now() }));
    } catch { /* 저장 못 해도 한 번은 보낸다 */ }
    track(kind as WebEventName, { q, pick: pick ?? null, region: region ?? null, hits });
  }, [q, kind, pick, region, hits]);
  return null;
}
