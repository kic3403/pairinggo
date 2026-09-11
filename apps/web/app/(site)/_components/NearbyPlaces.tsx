"use client";
/**
 * 이 음식 맛집 — 눌렀을 때만 불러온다.
 * 카카오 로컬은 유료 쿼터에 분당 제한이 있어 페이지를 열 때마다 부르면 금방 소진된다.
 * 위치는 브라우저가 허락할 때만 쓰고, 거부하면 지역 선택으로 넘어간다.
 */
import { useState } from "react";
import Heart from "./Heart";

type Place = { id: string; name: string; category: string; address: string; roadAddress: string; phone: string | null; distanceKm: number | null; placeUrl: string | null };
type Res = { places: Place[]; source: string; center: { lat: number; lng: number } | null; error?: string };

const REGIONS: { id: string; label: string }[] = [
  { id: "hongdae", label: "홍대" }, { id: "gangnam", label: "강남" }, { id: "jongno", label: "종로" },
  { id: "seongsu", label: "성수" }, { id: "yeonnam", label: "연남" }, { id: "itaewon", label: "이태원" },
];

export default function NearbyPlaces({ food }: { food: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "denied">("idle");
  const [res, setRes] = useState<Res | null>(null);

  const load = async (q: { lat?: number; lng?: number; region?: string }) => {
    setState("loading");
    const p = new URLSearchParams({ food });
    if (q.lat != null && q.lng != null) { p.set("lat", String(q.lat)); p.set("lng", String(q.lng)); }
    if (q.region) p.set("region", q.region);
    try {
      const r = await fetch(`/api/v1/places/restaurants?${p}`);
      setRes(r.ok ? await r.json() : { places: [], source: "none", center: null, error: "검색 실패" });
    } catch { setRes({ places: [], source: "none", center: null, error: "검색 실패" }); }
    setState("done");
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState("denied"); return; }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => void load({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setState("denied"),
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  return (
    <section>
      <h2>{food} 맛집</h2>
      {state === "idle" && (
        <>
          <p className="small muted" style={{ marginTop: -6 }}>내 주변이나 지역을 골라 찾아보세요. 마음에 드는 곳은 하트를 눌러 저장할 수 있습니다.</p>
          <div className="btns">
            <button className="btn p" onClick={useMyLocation}>내 주변에서 찾기</button>
          </div>
          <ul className="tabs" style={{ marginTop: 10 }}>
            {REGIONS.map((r) => (
              <li key={r.id}><button className="btn" style={{ minHeight: 40, padding: "0 15px" }} onClick={() => void load({ region: r.id })}>{r.label}</button></li>
            ))}
          </ul>
        </>
      )}

      {state === "loading" && <p className="muted">찾는 중…</p>}

      {state === "denied" && (
        <>
          <p className="muted">위치를 쓸 수 없어요. 지역을 골라 주세요.</p>
          <ul className="tabs">
            {REGIONS.map((r) => (
              <li key={r.id}><button className="btn" style={{ minHeight: 40, padding: "0 15px" }} onClick={() => void load({ region: r.id })}>{r.label}</button></li>
            ))}
          </ul>
        </>
      )}

      {state === "done" && res && (
        res.places.length ? (
          <ul className="places">
            {res.places.slice(0, 12).map((p) => (
              <li key={p.id} className="place">
                <div className="n">{p.name}</div>
                <div className="s">{[p.category, p.distanceKm != null ? `${p.distanceKm.toFixed(1)}km` : null, p.roadAddress || p.address].filter(Boolean).join(" · ")}</div>
                {p.placeUrl && <a className="lk" href={p.placeUrl} target="_blank" rel="noopener nofollow">카카오맵 ↗</a>}
                {p.phone && <a className="lk" href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} style={{ marginLeft: 12 }}>전화</a>}
                <Heart
                  kind="place" id={p.id} name={p.name}
                  meta={{ name: p.name, address: p.roadAddress || p.address, phone: p.phone ?? undefined, url: p.placeUrl ?? undefined, category: p.category, food }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{res.source === "none" ? "장소 검색을 쓸 수 없어요." : "결과가 없어요. 다른 지역으로 찾아보세요."}</p>
        )
      )}

      {state === "done" && (
        <div className="btns"><button className="btn" onClick={() => { setState("idle"); setRes(null); }}>다시 찾기</button></div>
      )}
    </section>
  );
}
