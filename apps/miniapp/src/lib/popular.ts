/**
 * 인기 검색어 — 서버 집계(popular_terms)가 있으면 우선, 없거나 실패하면 트렌드 순위(번들·서버 카탈로그).
 */
import { useEffect, useState } from "react";
import { POPULAR, POPULAR_FOODS } from "@pairinggo/shared";
import { fetchJson, apiEnabled } from "./api";
import { useCatalog } from "./catalog";

export type PopularItem = { id: string; name: string; type: "drink" | "food"; count: number };
type Popular = { source: "logs" | "trend"; drinks: PopularItem[]; foods: PopularItem[] };

let cached: Popular | null = null;
/** 세션당 한 번만 서버에 묻는다 (트렌드 폴백이어도 재요청하지 않음) */
let asked = false;

const fromTrend = (): Popular => ({
  source: "trend",
  drinks: POPULAR.map((d) => ({ id: d.id, name: d.alias || d.name, type: "drink", count: Math.round(d.trend?.score || 0) })),
  foods: POPULAR_FOODS.map((f) => ({ id: f.id, name: f.name, type: "food", count: Math.round(f.trend?.score || 0) })),
});

export function usePopular(): Popular {
  const { version } = useCatalog();
  const [p, setP] = useState<Popular>(() => cached ?? fromTrend());
  useEffect(() => {
    let alive = true;
    if (!cached) setP(fromTrend());
    if (!apiEnabled() || cached || asked) return;
    asked = true;
    void fetchJson<{ source: "logs" | "trend"; drinks: PopularItem[]; foods: PopularItem[] }>("/popular").then((r) => {
      if (!alive || !r.ok || r.data.source !== "logs" || !r.data.drinks.length) return;
      cached = { source: "logs", drinks: r.data.drinks.slice(0, 10), foods: r.data.foods.slice(0, 10) };
      setP(cached);
    });
    return () => { alive = false; };
  }, [version]);
  return p;
}
