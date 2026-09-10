import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { TOP_REGIONS, subRegions, fmtDistance, kakaoSearchUrl, type Place } from "@pairinggo/shared";
import { setRegion, toast, useRegion } from "@/lib/prefs";
import { apiEnabled, fetchPlaces, type PlacesResponse } from "@/lib/api";
import { getCurrentPosition } from "@/lib/location";
import { mapEnabled } from "@/lib/kakaoMap";
import { track } from "@/lib/analytics";
import NearbyLink from "@/components/NearbyLink";
import SaveButton from "@/components/SaveButton";
import ExtLink from "@/components/ExtLink";
import KakaoMap from "@/components/KakaoMap";
import { BackHeader } from "@/components/Section";

type Sort = "distance" | "accuracy";
const RADII = [{ m: 1000, label: "1km" }, { m: 3000, label: "3km" }, { m: 10000, label: "10km" }];

/**
 * 내 주변 식당 / 전통주 판매점 — 서버(카카오 로컬)에서 목록을 받아 거리순·정확도순으로, 지도 토글.
 *   /restaurants?food=육회            음식 파는 식당
 *   /restaurants?kind=bottleshop&trad=1   전통주 판매점 (trad=0: 주류판매점·보틀샵)
 * 서버·키가 없으면 네이버지도 링크 폴백(Phase 1 동작).
 */
export default function Restaurants() {
  const [sp] = useSearchParams();
  const food = sp.get("food") || "";
  const isShop = sp.get("kind") === "bottleshop";
  const trad = sp.get("trad") !== "0";
  const { st, cur, near, label } = useRegion();
  const [sort, setSort] = useState<Sort>("distance");
  const [radius, setRadius] = useState(3000);
  const [view, setView] = useState<"list" | "map">("list");
  const [data, setData] = useState<PlacesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const lastKey = useRef<string>("");
  const title = isShop ? (trad ? "전통주 파는 곳" : "주류 파는 곳") : `${food} 파는 곳`;

  const center = useMemo(() => (st.gps && st.lat != null && st.lng != null ? { lat: st.lat, lng: st.lng } : null), [st.gps, st.lat, st.lng]);
  const regionId = !st.gps && st.id !== "all" ? st.id : undefined;
  const basis = center ? "현재 위치" : regionId ? label : "지역 미선택";

  const load = useCallback(async () => {
    if (!apiEnabled() || (!food && !isShop)) return;
    if (!center && !regionId) { setData(null); return; }
    const params = { food: isShop ? undefined : food, kind: isShop ? (trad ? "trad" : "all") : undefined, lat: center?.lat, lng: center?.lng, radius, region: center ? undefined : regionId, sort };
    // 같은 조건의 요청은 한 번만 (StrictMode 이중 실행·스토어 갱신으로 인한 중복 호출 방지 → 카카오 쿼터 보호)
    const key = JSON.stringify(params);
    if (lastKey.current === key) return;
    lastKey.current = key;
    setLoading(true);
    const r = await fetchPlaces(isShop ? "bottleshops" : "restaurants", params);
    if (lastKey.current !== key) return;
    setData(r); setLoading(false); setSelected(null);
    track("restaurant_list", { food: isShop ? (trad ? "전통주판매점" : "주류판매점") : food, n: r?.places.length ?? -1, source: r?.source ?? "offline", basis: center ? "gps" : regionId ?? "none" });
  }, [food, isShop, trad, center, regionId, radius, sort]);
  useEffect(() => { void load(); }, [load]);

  const useGps = async () => {
    setLocBusy(true);
    const c = await getCurrentPosition();
    setLocBusy(false);
    if (!c) toast("위치를 가져올 수 없어요. 관심지역을 골라 주세요");
  };

  const places: Place[] = data?.places ?? [];
  const online = apiEnabled() && data?.source === "kakao";
  const fallbackQ = isShop ? (trad ? "전통주 판매점" : "주류판매점") : `${food} 맛집`;

  return (
    <main className="px-4 pt-4">
      <BackHeader title={title} sub={`${basis}${center || regionId ? ` · 반경 ${radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}` : ""}${online ? " · 카카오 로컬" : ""}`} />

      {/* 기준 위치 */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={useGps} disabled={locBusy} className={`chip ${st.gps ? "on" : ""}`}>{locBusy ? "확인 중…" : st.gps ? "현재 위치 사용 중" : "현재 위치"}</button>
        <button onClick={() => setPickOpen((v) => !v)} className={`chip ${!st.gps && st.id !== "all" ? "on" : ""}`}>{!st.gps && st.id !== "all" ? cur.label : "관심지역 고르기"} ▾</button>
      </div>
      {pickOpen && (
        <section className="card p-3 mt-2">
          <div className="flex flex-wrap gap-1.5">
            {TOP_REGIONS.filter((r) => r.id !== "all").map((r) => <button key={r.id} onClick={() => { setRegion(r.id); setPickOpen(false); }} className={`chip !text-[12.5px] ${!st.gps && (st.id === r.id || cur.parent === r.id) ? "on" : ""}`}>{r.label}</button>)}
          </div>
          <div className="text-[11px] font-bold text-ink2 mt-2.5">수도권 세부</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {subRegions("cap").map((r) => <button key={r.id} onClick={() => { setRegion(r.id); setPickOpen(false); }} className={`chip !text-[12px] ${!st.gps && st.id === r.id ? "on" : ""}`}>{r.label}</button>)}
          </div>
        </section>
      )}

      {/* 반경 · 정렬 · 보기 */}
      {(center || regionId) && apiEnabled() && (
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex gap-1.5">{RADII.map((r) => <button key={r.m} onClick={() => setRadius(r.m)} className={`chip !px-2.5 !py-1 !text-[12px] ${radius === r.m ? "on" : ""}`}>{r.label}</button>)}</div>
          <div className="flex bg-surface2 rounded-lg p-0.5 gap-0.5 text-[12px] font-bold">
            {(["distance", "accuracy"] as Sort[]).map((s) => <button key={s} onClick={() => setSort(s)} className={`px-2.5 py-1 rounded-md ${sort === s ? "bg-surface text-ink shadow" : "text-muted"}`}>{s === "distance" ? "거리순" : "정확도순"}</button>)}
            {mapEnabled() && <button onClick={() => setView((v) => (v === "list" ? "map" : "list"))} className="px-2.5 py-1 rounded-md text-drink-ink">{view === "list" ? "지도" : "목록"}</button>}
          </div>
        </div>
      )}

      {!center && !regionId && <p className="card p-4 mt-3 text-[13px] text-ink2">현재 위치를 허용하거나 관심지역을 고르면 주변 {isShop ? "판매점" : "식당"}을 찾아드려요.</p>}
      {loading && <p className="mt-4 text-sm text-muted">주변 {isShop ? "판매점" : "식당"}을 찾는 중…</p>}

      {!loading && online && view === "map" && (
        <div className="mt-3">
          <KakaoMap center={center ?? (data?.center ? { lat: data.center.lat, lng: data.center.lng } : null)} places={places} selected={selected} onSelect={setSelected} height={300} />
          {selected && (() => { const p = places.find((x) => x.id === selected); return p ? <div className="mt-2"><PlaceCard p={p} i={places.indexOf(p)} food={food} region={regionId ? cur.label : ""} /></div> : null; })()}
        </div>
      )}

      {!loading && online && view === "list" && (
        <div className="flex flex-col gap-3 mt-3">
          {places.map((p, i) => <PlaceCard key={p.id} p={p} i={i} food={food} region={regionId ? cur.label : ""} />)}
          {!places.length && <p className="text-[13px] text-muted py-6 text-center">반경 안에 결과가 없어요. 반경을 넓히거나 다른 지역을 골라 보세요.</p>}
        </div>
      )}

      {!loading && (center || regionId) && !online && (
        <section className="card p-4 mt-3">
          <p className="text-[13px] text-ink2">{apiEnabled() ? "장소 검색 서버에 연결할 수 없어요. 네이버지도로 이어서 찾을 수 있어요." : "지금은 네이버지도 검색으로 연결됩니다."}</p>
          <div className="flex flex-col gap-2 mt-3">
            <NearbyLink name={fallbackQ} className="btn btn-navy">{near} {fallbackQ} · 네이버지도 →</NearbyLink>
            <ExtLink href={kakaoSearchUrl(`${st.gps ? "" : cur.q} ${fallbackQ}`.trim())} kind="map" className="btn btn-ghost">{near} {fallbackQ} · 카카오맵 →</ExtLink>
          </div>
        </section>
      )}

      {online && !!places.length && (
        <p className="text-[11px] text-muted mt-4 leading-relaxed">
          장소 정보는 카카오 로컬 제공이며 영업 여부·메뉴는 방문 전 확인을 권해요. 별점순 정렬과 예약 가능 표시는 다음 업데이트에서 제공합니다.
          {!isShop && <> 술과 함께 즐기려면 <Link to={`/search?q=${encodeURIComponent(food + "에 어울리는 술")}`} className="text-drink-ink font-semibold">{food}에 어울리는 술 →</Link></>}
        </p>
      )}
    </main>
  );
}

function PlaceCard({ p, i, food, region }: { p: Place; i: number; food: string; region: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-2.5">
        <span className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${i === 0 ? "bg-accent text-on-strong" : i < 3 ? "bg-accent-soft text-accent-ink" : "bg-surface2 text-muted"}`}>{i + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="font-serif font-bold text-[16px] leading-snug">{p.name} <small className="font-sans font-medium text-[11px] text-muted">{p.category}</small></div>
          <div className="text-[12px] text-muted mt-0.5 truncate">{p.roadAddress || p.address}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] mt-1.5">
            {p.distanceKm != null && <span className="font-bold text-accent num">{fmtDistance(p.distanceKm)}</span>}
            {p.phone && <span className="text-muted num">{p.phone}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3 items-center">
        <SaveButton item={{ k: "place", name: p.name, food, address: p.roadAddress || p.address, url: p.placeUrl || undefined, region }} className="!px-2" />
        {p.placeUrl && <ExtLink className="btn btn-navy flex-1 !py-2.5 !text-[13px]" href={p.placeUrl} kind="map" meta={{ place: p.id }}>카카오맵에서 보기</ExtLink>}
        {p.phone && <ExtLink className="btn btn-ghost flex-1 !py-2.5 !text-[13px]" href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} kind="tel">전화</ExtLink>}
      </div>
    </div>
  );
}
