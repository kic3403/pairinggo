"use client";
/**
 * 검색 로그 — 검색 결과 화면이 뜨면 미니앱과 같은 이벤트(search·search_intent·search_empty)를 보낸다.
 * /api/v1/events 가 이 셋을 search_logs 로도 넣는다(pick "drink:d01" → matched). 서버에서 직접 넣지 않는 이유:
 * 관심지역이 있으면 /search?q= 가 곧바로 ?region= 으로 다시 열려 같은 검색이 두 번 찍힌다 → 같은 검색어는 60초 안에 한 번만.
 * 술·음식이 없을 때는 식당 결과를 보고 정한다(2026-10-01 — 식당 이름 검색이 '결과 없음'으로 잡혀 대시보드·없는 술 목록이 부풀었다):
 * 이때는 이 컴포넌트가 아니라 식당 칸(SearchPlaces)이 logSearch로 보낸다(waitPlaces).
 */
import { useEffect } from "react";
import { track, type WebEventName } from "@/lib/track";

type Kind = "search" | "search_intent" | "search_empty";
type Props = { q: string; kind: Kind; pick?: string | null; region?: string | null; hits: number; waitPlaces?: boolean };

/** 검색 한 번 기록 — 같은 검색어는 60초 안에 한 번만 */
export function logSearch(q: string, kind: Kind, extra: { pick?: string | null; region?: string | null; hits: number }) {
  if (!q) return;
  try {
    const last = JSON.parse(window.sessionStorage.getItem("pg_lastq") || "null") as { q: string; t: number } | null;
    if (last && last.q === q && Date.now() - last.t < 60_000) return;
    window.sessionStorage.setItem("pg_lastq", JSON.stringify({ q, t: Date.now() }));
  } catch { /* 저장 못 해도 한 번은 보낸다 */ }
  track(kind as WebEventName, { q, pick: extra.pick ?? null, region: extra.region ?? null, hits: extra.hits });
}

export default function SearchLog({ q, kind, pick, region, hits, waitPlaces }: Props) {
  useEffect(() => {
    if (!q || waitPlaces) return;
    logSearch(q, kind, { pick, region, hits });
  }, [q, kind, pick, region, hits, waitPlaces]);
  return null;
}
