"use client";
/**
 * 내 주변 — 음식이면 맛집, 술이면 파는 곳(전통주 판매점·보틀샵, 온라인 불가 주류는 마트·주류판매점).
 * 눌렀을 때만 불러온다. 카카오 로컬은 유료 쿼터에 분당 제한이 있어 페이지를 열 때마다 부르면 금방 소진된다.
 * 위치는 브라우저가 허락할 때만 쓰고, 거부하면 지역 선택으로 넘어간다.
 */
import { useState } from "react";
import Heart from "./Heart";

type Place = { id: string; name: string; category: string; address: string; roadAddress: string; phone: string | null; distanceKm: number | null; placeUrl: string | null };
type Res = { places: Place[]; source: string; error?: string };
type Props = { mode: "restaurants"; food: string } | { mode: "bottleshops"; drinkName: string; trad: boolean };

const REGIONS: { id: string; label: string }[] = [
  { id: "hongdae", label: "홍대" }, { id: "gangnam", label: "강남" }, { id: "jongno", label: "종로" },
  { id: "seongsu", label: "성수" }, { id: "yeonnam", label: "연남" }, { id: "itaewon", label: "이태원" },
];

export default function NearbyPlaces(props: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "denied">("idle");
  const [res, setRes] = useState<Res | null>(null);
  const [where, setWhere] = useState<string>("");

  const title = props.mode === "restaurants" ? `${props.food} 맛집` : props.trad ? "이 술 파는 곳" : "가까운 주류판매점";
  const hint = props.mode === "restaurants"
    ? "내 주변이나 지역을 골라 찾아보세요. 마음에 드는 곳은 하트를 눌러 저장할 수 있습니다."
    : props.trad
      ? "전통주 판매점과 보틀샵을 찾습니다. 재고는 매장마다 다르니 전화로 확인하는 게 좋습니다."
      : "이 술은 전통주가 아니라 온라인 직배송이 안 됩니다. 주류판매점·마트·편의점을 찾습니다.";
  const savedAs = props.mode === "restaurants" ? props.food : props.drinkName;

  const load = async (q: { lat?: number; lng?: number; region?: string }, label: string) => {
    setState("loading"); setWhere(label);
    const p = new URLSearchParams();
    if (q.lat != null && q.lng != null) { p.set("lat", String(q.lat)); p.set("lng", String(q.lng)); }
    if (q.region) p.set("region", q.region);
    let url: string;
    if (props.mode === "restaurants") { p.set("food", props.food); url = `/api/v1/places/restaurants?${p}`; }
    else { p.set("kind", props.trad ? "trad" : "all"); url = `/api/v1/places/bottleshops?${p}`; }
    try {
      const r = await fetch(url);
      setRes(r.ok ? await r.json() : { places: [], source: "none", error: "검색 실패" });
    } catch { setRes({ places: [], source: "none", error: "검색 실패" }); }
    setState("done");
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState("denied"); return; }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => void load({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "내 주변"),
      () => setState("denied"),
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  const RegionButtons = () => (
    <ul className="tabs" style={{ marginTop: 10 }}>
      {REGIONS.map((r) => (
        <li key={r.id}><button className="btn" style={{ minHeight: 40, padding: "0 15px" }} onClick={() => void load({ region: r.id }, r.label)}>{r.label}</button></li>
      ))}
    </ul>
  );

  return (
    <section id="places">
      <h2>{title}</h2>
      {state === "idle" && (
        <>
          <p className="small muted" style={{ marginTop: -6 }}>{hint}</p>
          <div className="btns"><button className="btn p" onClick={useMyLocation}>내 주변에서 찾기</button></div>
          <RegionButtons />
        </>
      )}
      {state === "loading" && <p className="muted">{where}에서 찾는 중…</p>}
      {state === "denied" && (<><p className="muted">위치를 쓸 수 없어요. 지역을 골라 주세요.</p><RegionButtons /></>)}
      {state === "done" && res && (
        res.places.length ? (
          <>
            <p className="small muted">{where} · {res.places.length}곳</p>
            <ul className="places">
              {res.places.slice(0, 12).map((p) => (
                <li key={p.id} className="place">
                  <div className="n">{p.name}</div>
                  <div className="s">{[p.category, p.distanceKm != null ? `${p.distanceKm.toFixed(1)}km` : null, p.roadAddress || p.address].filter(Boolean).join(" · ")}</div>
                  {p.placeUrl && <a className="lk" href={p.placeUrl} target="_blank" rel="noopener nofollow">카카오맵 ↗</a>}
                  {p.phone && <a className="lk" href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} style={{ marginLeft: 12 }}>전화</a>}
                  <Heart kind="place" id={p.id} name={p.name}
                    meta={{ name: p.name, address: p.roadAddress || p.address, phone: p.phone ?? undefined, url: p.placeUrl ?? undefined, category: p.category, food: savedAs }} />
                </li>
              ))}
            </ul>
          </>
        ) : <p className="muted">{res.source === "none" ? "장소 검색을 쓸 수 없어요." : "결과가 없어요. 다른 지역으로 찾아보세요."}</p>
      )}
      {state === "done" && <div className="btns"><button className="btn" onClick={() => { setState("idle"); setRes(null); }}>다시 찾기</button></div>}
    </section>
  );
}
