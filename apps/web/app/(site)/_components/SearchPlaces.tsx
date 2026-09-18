"use client";
/**
 * 술·음식 검색 결과 화면의 "식당" 칸(2026-09-19 사용자 요청) — 같은 검색어로 식당도 함께 보여 준다.
 * 검색은 사용자가 한 것이라 카카오를 한 번 부른다(10분 캐시). 구글 평점은 붙이지 않는다(lite, 하루 150회 상한 보호).
 * 지역: 검색 화면에서 고른 지역 → 없으면 관심지역 → 없으면 전국. 주변에 그 이름이 없으면 API가 전국에서 찾아 앞에 붙인다.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import PlaceList, { type PlaceView } from "./PlaceList";
import { useHydrated, useRegion } from "./RegionProvider";
import { track } from "@/lib/track";

type Res = { places: PlaceView[]; source: string; awardsYear?: number | null; widened?: boolean };
const SHOW = 5;

export default function SearchPlaces({ q, region, empty }: { q: string; region: { id: string; label: string } | null; empty: boolean }) {
  const rg = useRegion();
  const hydrated = useHydrated();
  const [res, setRes] = useState<Res | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    const p = new URLSearchParams({ q, lite: "1" });
    let lbl = "전국";
    if (region) { p.set("region", region.id); lbl = `${region.label} 주변`; }
    else if (rg.region) {
      if (rg.gps) { p.set("lat", String(rg.gps.lat)); p.set("lng", String(rg.gps.lng)); } else p.set("region", rg.id);
      lbl = `${rg.label} 주변`;
    }
    setRes(null);
    fetch(`/api/v1/places/search?${p}`)
      .then((r) => (r.ok ? r.json() : { places: [], source: "none" }))
      .then((j: Res) => {
        if (!alive) return;
        setLabel(j.widened ? `${lbl} + 전국` : lbl); setRes(j);
        track("restaurant_list", { mode: "search_page", n: j.places.length, source: j.source, basis: region?.id ?? (rg.region ? rg.id : "all") });
      })
      .catch(() => alive && setRes({ places: [], source: "none" }));
    return () => { alive = false; };
  }, [q, region?.id, hydrated, rg.id, rg.gps, rg.region]); // eslint-disable-line react-hooks/exhaustive-deps

  const more = `/places?q=${encodeURIComponent(q)}`;
  if (!res) return <section className="search-places"><h2>‘{q}’ 식당</h2><p className="muted small">식당을 찾는 중…</p></section>;
  if (!res.places.length) return empty ? <section className="search-places"><h2>‘{q}’ 식당</h2><p className="muted small">{label}에서 찾은 식당도 없어요. <Link href={more}>식당 찾기에서 다른 지역으로 찾기 →</Link></p></section> : null;
  return (
    <section className="search-places">
      <h2>‘{q}’ 식당 <span className="muted small">{res.places.length > SHOW ? `${SHOW}곳 먼저` : `${res.places.length}곳`}</span></h2>
      <PlaceList places={res.places} where={label} awardsYear={res.awardsYear ?? null} restaurants eventKey={{}} savedAs={q} limit={SHOW} />
      <div className="btns" style={{ marginTop: 10 }}><Link className="btn" href={more}>식당 더 보기 · 평점·다른 지역 →</Link></div>
    </section>
  );
}
