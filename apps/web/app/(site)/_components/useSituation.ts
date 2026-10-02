"use client";
/**
 * 사는 곳 날씨·계절 상황을 서버(`/api/v1/situation`)에서 받아 오는 훅(docs/29) — WeatherPick(칸)과 SituationChip(홈 모음 칩)이 같이 쓴다.
 * 시·도 = 로그인 회원의 프로필 시·도 → 기기 관심 지역 → 없으면 서버가 서울로(assumed). 같은 주소는 브라우저가 5분 캐시해 두 번 묻지 않는다.
 */
import { useEffect, useState } from "react";
import { useRegion } from "./RegionProvider";
import { useSaved } from "./SavedProvider";

export type SituationItem = { d: string; f: string; drink: string; food: string; dslug: string; fslug: string; category: string; region: string; conf: string; grade: string; fit: "both" | "food" | "drink"; local: boolean };
export type SituationResp = {
  situation: { key: string; headline: string; why: string; icon: string; title: string; temp: number | null; precip: string; fromWeather: boolean; sido: string; assumed: boolean; at: string | null };
  /** 이 상황의 모음 화면(근거 조합 10개 이상일 때만) */
  guide: { slug: string; h1: string } | null;
  self?: boolean; items: SituationItem[];
};

export function useSituation(mode: "home" | "drink" | "food", id?: string, n?: number): SituationResp | null {
  const saved = useSaved();
  const region = useRegion();
  const [data, setData] = useState<SituationResp | null>(null);
  const memberSido = saved.user?.sido ?? null;
  const ready = saved.ready && region.ready;
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (memberSido) q.set("sido", memberSido);
    else if (region.id && region.id !== "all") q.set("region", region.id);
    if (mode === "drink" && id) q.set("d", id);
    if (mode === "food" && id) q.set("f", id);
    if (n) q.set("n", String(n));
    let alive = true;
    fetch(`/api/v1/situation?${q}`).then((r) => (r.ok ? r.json() : null)).then((j: SituationResp | null) => { if (alive) setData(j); }).catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [ready, memberSido, region.id, mode, id, n]);
  return data;
}
