"use client";
/**
 * 내 주변 — 음식이면 맛집, 술이면 파는 곳(전통주 판매점·보틀샵, 온라인 불가 주류는 마트·주류판매점).
 * 눌렀을 때만 불러온다. 카카오 로컬은 유료 쿼터에 분당 제한이 있어 페이지를 열 때마다 부르면 금방 소진된다.
 * 위치는 브라우저가 허락할 때만 쓰고, 거부하면 지역 선택으로 넘어간다.
 * 관심지역이 있으면 그 지역 검색이 기본 버튼, 현재 위치는 보조 버튼(2026-09-14 — 관심지역을 강남으로 두고도 맨 위 "내 주변" 버튼을 눌러
 * 현재 위치 결과가 나온다는 사용자 지적). 관심지역을 "현재 위치로" 정했으면 그 좌표를 쓴다(지역 대표 좌표보다 정확).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { placeChips, placeNoteLine, ratingText, verifiedLabel, type PlaceAmenities, type PlaceInfo, type PlaceRating } from "@pairinggo/shared";
import Heart from "./Heart";
import { track } from "@/lib/track";
import { useHydrated, useRegion } from "./RegionProvider";

type Award = { guide: string; year: number; kind: "star" | "bib" | "green" | "selected"; level: number; label: string; url?: string | null };
type Place = { id: string; name: string; category: string; address: string; roadAddress: string; phone: string | null; distanceKm: number | null; placeUrl: string | null; award?: Award | null; rating?: PlaceRating | null; amenities?: PlaceAmenities | null; info?: PlaceInfo | null; infoView?: { drinks: Named[]; foods: Named[] } };
type Named = { id: string; name: string; slug: string };
type Res = { places: Place[]; source: string; error?: string; awardsYear?: number | null; ratingSource?: "google" | null };
const blueRibbonUrl = (name: string) => `https://www.bluer.co.kr/search?query=${encodeURIComponent(name)}`;
type Props = ({ mode: "restaurants"; food: string; foodId: string } | { mode: "bottleshops"; drinkName: string; drinkId: string; trad: boolean }) & {
  /** 버튼 줄 오른쪽에 붙일 것(음식 상세의 저장 버튼). 결과를 보는 동안은 제목 옆으로 옮겨 항상 보이게 한다 */
  actions?: ReactNode;
};

/** 관심지역이 없을 때 바로 고를 수 있는 곳 — id는 packages/shared/src/regions.ts와 같아야 한다 */
const QUICK: { id: string; label: string }[] = [
  { id: "hongdae", label: "홍대" }, { id: "gangnam", label: "강남" }, { id: "jongno", label: "종로" },
  { id: "seongsu", label: "성수" }, { id: "yongsan", label: "이태원" }, { id: "busan", label: "부산" },
];

export default function NearbyPlaces(props: Props) {
  const rg0 = useRegion();
  const hydrated = useHydrated();
  // 하이드레이션 중에는 서버와 같은 화면(전국) — 관심지역 버튼은 그 뒤에 나타난다
  const rg = hydrated ? rg0 : { ...rg0, id: "all", region: null, label: "전국", gps: null };
  // closed: 결과를 본 뒤 "닫기" — 제목과 "열기"만 남긴다(아래 페어링 목록으로 빨리 내려가게)
  const [state, setState] = useState<"idle" | "loading" | "done" | "denied" | "closed">("idle");
  const [res, setRes] = useState<Res | null>(null);
  const [where, setWhere] = useState<string>("");
  // 결과를 보는 중에 관심지역을 바꾸면(상세 화면에서는 시트가 그 자리에 남는다) 처음 화면으로 돌아가 새 지역 버튼을 보여 준다
  const lastRegion = useRef(rg.id);
  useEffect(() => { if (lastRegion.current !== rg.id) { lastRegion.current = rg.id; setState("idle"); setRes(null); } }, [rg.id]);

  const title = props.mode === "restaurants" ? `${props.food} 맛집` : props.trad ? "이 술 파는 곳" : "가까운 주류판매점";
  const hint = props.mode === "restaurants"
    ? rg.region ? `관심지역 ${rg.label} 기준으로 찾습니다. 지금 있는 곳 주변이나 다른 지역으로도 찾을 수 있어요.` : "내 주변이나 지역을 골라 찾아보세요. 마음에 드는 곳은 하트를 눌러 저장할 수 있습니다."
    : props.trad
      ? "전통주 판매점과 보틀샵을 찾습니다. 재고는 매장마다 다르니 전화로 확인하는 게 좋습니다."
      : "이 술은 전통주가 아니라 온라인 직배송이 안 됩니다. 주류판매점·마트·편의점을 찾습니다.";
  const savedAs = props.mode === "restaurants" ? props.food : props.drinkName;
  /** 이벤트 집계 키 — 음식 상세면 f, 술 상세면 d (refresh_pairing_feedback이 d/f 로 묶는다) */
  const key: Record<string, string> = props.mode === "restaurants" ? { f: props.foodId } : { d: props.drinkId };

  const load = async (q: { lat?: number; lng?: number; region?: string }, label: string) => {
    setState("loading"); setWhere(label);
    const p = new URLSearchParams();
    if (q.lat != null && q.lng != null) { p.set("lat", String(q.lat)); p.set("lng", String(q.lng)); }
    if (q.region) p.set("region", q.region);
    let url: string;
    if (props.mode === "restaurants") { p.set("food", props.food); url = `/api/v1/places/restaurants?${p}`; }
    else { p.set("kind", props.trad ? "trad" : "all"); url = `/api/v1/places/bottleshops?${p}`; }
    let out: Res;
    try {
      const r = await fetch(url);
      out = r.ok ? await r.json() : { places: [], source: "none", error: "검색 실패" };
    } catch { out = { places: [], source: "none", error: "검색 실패" }; }
    setRes(out);
    setState("done");
    track("restaurant_list", { food: savedAs, mode: props.mode, n: out.places.length, source: out.source, basis: q.lat != null ? "gps" : q.region ?? "none" });
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

  /** 관심지역으로 찾기 — "현재 위치로" 정한 지역이면 저장된 좌표, 아니면 지역 대표 좌표(API의 region) */
  const loadRegion = () => void (rg.gps ? load({ lat: rg.gps.lat, lng: rg.gps.lng }, `${rg.label}(현재 위치)`) : load({ region: rg.id }, `관심지역 ${rg.label}`));

  /** 첫 줄 버튼 — 관심지역이 있으면 그게 기본(남색), 현재 위치는 주황. 오른쪽에 actions(저장) */
  const MainButtons = () => (
    <div className="btns">
      {rg.region ? (
        <>
          <button className="btn p" onClick={loadRegion}>📍 {rg.label}에서 찾기</button>
          <button className="btn f" onClick={useMyLocation}>지금 내 위치 주변</button>
        </>
      ) : (
        <button className="btn f" onClick={useMyLocation}>내 주변에서 찾기</button>
      )}
      {props.actions}
    </div>
  );
  const RegionButtons = () => (
    <ul className="tabs" style={{ marginTop: 10 }}>
      {QUICK.filter((r) => r.id !== rg.id).map((r) => (
        <li key={r.id}><button className="btn" style={{ minHeight: 40, padding: "0 15px" }} onClick={() => void load({ region: r.id }, r.label)}>{r.label}</button></li>
      ))}
      <li><button className="btn" style={{ minHeight: 40, padding: "0 15px" }} onClick={rg.open}>다른 지역 ▾</button></li>
    </ul>
  );

  return (
    <section id="places">
      <div className="sec-head">
        <h2>{title}</h2>
        {state === "done" && (
          <>
            <button type="button" className="btn xs" onClick={() => { setState("idle"); setRes(null); }}>다시 찾기</button>
            <button type="button" className="btn xs" onClick={() => setState("closed")}>닫기</button>
          </>
        )}
        {state === "closed" && <button type="button" className="btn xs" onClick={() => { setState("idle"); setRes(null); }}>열기</button>}
        {(state === "done" || state === "closed" || state === "loading") && props.actions}
      </div>
      {state === "idle" && (
        <>
          <p className="small muted" style={{ marginTop: -6 }}>{hint}</p>
          <MainButtons />
          <RegionButtons />
        </>
      )}
      {state === "loading" && <p className="muted">{where}에서 찾는 중…</p>}
      {state === "denied" && (
        <>
          <p className="muted">위치를 쓸 수 없어요. {rg.region ? "관심지역이나 다른 지역으로 찾아보세요." : "지역을 골라 주세요."}</p>
          {rg.region && <div className="btns" style={{ marginTop: 8 }}><button className="btn p" onClick={loadRegion}>📍 {rg.label}에서 찾기</button></div>}
          <RegionButtons />
        </>
      )}
      {state === "done" && res && (
        res.places.length ? (
          <>
            <p className="small muted">{where} · {res.places.length}곳{res.places.some((p) => p.rating) ? " · ★ 평점은 Google 지도 이용자 평가" : ""}{res.places.some((p) => p.info) ? " · 색이 있는 칩은 페어링GO가 매장에 직접 확인한 정보" : ""}{res.places.some((p) => placeChips(null, p.amenities).length) ? " · 회색 칩(주차·단체·예약)은 Google 지도 정보" : ""}{res.places.some((p) => p.award) && res.awardsYear ? ` · 미쉐린 배지는 미쉐린 가이드 서울&부산 ${res.awardsYear} 선정(공개된 사실을 출처와 함께 표시, 로고 아님)` : ""}</p>
            <ul className="places">
              {res.places.slice(0, 12).map((p) => (
                <li key={p.id} className="place">
                  <div className="n">
                    {p.name}
                    {p.award && (
                      <span className={`award ${p.award.kind}`} title={`${p.award.label} — 미쉐린 가이드 서울&부산 ${p.award.year} 선정`}>
                        {p.award.kind === "star" ? <><span className="stars" aria-hidden>{"★".repeat(Math.max(1, Math.min(3, p.award.level)))}</span> 미쉐린 {p.award.year}</> : p.award.kind === "bib" ? `빕구르망 ${p.award.year}` : p.award.label}
                      </span>
                    )}
                    {placeChips(p.info, p.amenities).map((c) => <span key={c.key} className={`amen ${c.tone}${c.verified ? " ok" : ""}`} title={c.verified ? "페어링GO가 매장에 확인한 정보" : "Google 지도 정보 — 방문 전 매장에 확인하세요"}>{c.label}</span>)}
                  </div>
                  <div className="s">
                    {p.rating && <span className="rating" title={`Google 지도 이용자 평점 ${p.rating.score.toFixed(1)} · 리뷰 ${p.rating.count.toLocaleString("ko-KR")}개`}>{ratingText(p.rating)}<i>Google</i></span>}
                    {[p.category, p.distanceKm != null ? `${p.distanceKm.toFixed(1)}km` : null, p.roadAddress || p.address].filter(Boolean).join(" · ")}
                  </div>
                  {p.info && (
                    <div className="pinfo">
                      <span className="pv">{verifiedLabel(p.info)}</span>
                      {placeNoteLine(p.info) && <span> · {placeNoteLine(p.info)}</span>}
                      {!!p.infoView?.drinks.length && <div><b>전통주</b> {p.infoView.drinks.map((d, i) => <span key={d.id}>{i > 0 && " · "}<Link href={`/drinks/${d.slug}`}>{d.name}</Link></span>)}</div>}
                      {(!!p.infoView?.foods.length || p.info.menuNote) && <div><b>메뉴</b> {p.infoView?.foods.map((x, i) => <span key={x.id}>{i > 0 && " · "}<Link href={`/foods/${x.slug}`}>{x.name}</Link></span>)}{p.info.menuNote && <span>{p.infoView?.foods.length ? " · " : ""}{p.info.menuNote}</span>}</div>}
                    </div>
                  )}
                  {p.placeUrl && <a className="lk" href={p.placeUrl} target="_blank" rel="noopener nofollow" onClick={() => track("restaurant_link_click", { ...key, place: p.name, kind: "kakao_map" })}>카카오맵 ↗</a>}
                  {p.phone && <a className="lk" href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} style={{ marginLeft: 12 }} onClick={() => track("restaurant_link_click", { ...key, place: p.name, kind: "tel" })}>전화</a>}
                  {props.mode === "restaurants" && <a className="lk br" href={blueRibbonUrl(p.name)} target="_blank" rel="noopener nofollow" style={{ marginLeft: 12 }} onClick={() => track("external_link", { ...key, place: p.name, kind: "blueribbon" })}>블루리본 확인 ↗</a>}
                  <Heart kind="place" id={p.id} name={p.name}
                    meta={{ name: p.name, address: p.roadAddress || p.address, phone: p.phone ?? undefined, url: p.placeUrl ?? undefined, category: p.category, food: savedAs }} />
                </li>
              ))}
            </ul>
          </>
        ) : <p className="muted">{res.source === "none" ? "장소 검색을 쓸 수 없어요." : "결과가 없어요. 다른 지역으로 찾아보세요."}</p>
      )}
    </section>
  );
}
