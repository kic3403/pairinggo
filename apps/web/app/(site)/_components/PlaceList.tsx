"use client";
/**
 * 식당·판매점 카드 목록 — 음식 상세의 "맛집 찾기"(NearbyPlaces)와 식당 검색(/places)이 함께 쓴다(2026-09-19 떼어 냄).
 * 칩(운영자·파트너 확인 = 남색, 구글 = 회색) · 구글 평점 · 확인 정보 상자 · 메뉴판 · [예약하기](파트너 매장) · 지도·전화·저장.
 */
import Link from "next/link";
import { placeChips, placeNoteLine, ratingText, verifiedLabel, type PlaceAmenities, type PlaceInfo, type PlaceMatch, type PlaceRating, type ReviewStats } from "@pairinggo/shared";
import Heart from "./Heart";
import MenuBoard, { MenuThumbs } from "./MenuBoard";
import { track } from "@/lib/track";

type Award = { guide: string; year: number; kind: "star" | "bib" | "green" | "selected"; level: number; label: string; url?: string | null };
type Named = { id: string; name: string; slug: string | null };
export type PlaceView = { id: string; name: string; category: string; address: string; roadAddress: string; phone: string | null; distanceKm: number | null; placeUrl: string | null; award?: Award | null; rating?: PlaceRating | null; amenities?: PlaceAmenities | null; info?: PlaceInfo | null; infoView?: { drinks: Named[]; foods: Named[] }; bookable?: boolean; reviews?: ReviewStats; match?: PlaceMatch | null };
/** 블루리본은 식당 가이드라 양조장·리쿼샵 파트너에는 붙이지 않는다(2026-09-20) */
const blueRibbonUrl = (name: string) => `https://www.bluer.co.kr/search?query=${encodeURIComponent(name)}`;

export default function PlaceList({ places, where, awardsYear, restaurants, reserveFood, reserveDrink, eventKey, savedAs, limit = 12 }: {
  places: PlaceView[]; where: string; awardsYear: number | null;
  /** 음식점 목록(블루리본 링크) — 판매점 목록이면 false */
  restaurants: boolean;
  /** [예약하기]에 붙일 음식 id(음식 상세에서 들어온 페어링) */
  reserveFood?: string;
  /** [예약하기]에 붙일 술 id(술 화면에서 골라 들어온 조합) */
  reserveDrink?: string;
  eventKey: Record<string, string>; savedAs: string; limit?: number;
}) {
  return (
    <>
      <p className="small muted">{where} · {places.length}곳{places.some((p) => p.rating) ? " · ★ 평점은 Google 지도 이용자 평가" : ""}{places.some((p) => p.info) ? " · 색이 있는 칩은 페어링GO가 매장에 직접 확인한 정보" : ""}{places.some((p) => placeChips(null, p.amenities).length) ? " · 회색 칩(주차·단체·예약)은 Google 지도 정보" : ""}{places.some((p) => p.award) && awardsYear ? ` · 미쉐린 배지는 미쉐린 가이드 서울&부산 ${awardsYear} 선정(공개된 사실을 출처와 함께 표시, 로고 아님)` : ""}</p>
      <ul className="places">
        {places.slice(0, limit).map((p) => (
          <li key={p.id} className={`place${p.match && p.match.score >= 60 ? " matched" : ""}`}>
            {p.match ? <div className={`pmatch${p.match.score >= 60 ? " strong" : ""}`} title="페어링GO가 매장에 확인한 메뉴·술 기준">{p.match.score >= 90 ? "딱 맞는 곳 · " : ""}{p.match.label}</div> : null}
            <div className="n">
              <Link className="pname" href={`/places/${p.id}?n=${encodeURIComponent(p.name)}`}>{p.name}</Link>
              {p.award && (
                <span className={`award ${p.award.kind}`} title={`${p.award.label} — 미쉐린 가이드 서울&부산 ${p.award.year} 선정`}>
                  {p.award.kind === "star" ? <><span className="stars" aria-hidden>{"★".repeat(Math.max(1, Math.min(3, p.award.level)))}</span> 미쉐린 {p.award.year}</> : p.award.kind === "bib" ? `빕구르망 ${p.award.year}` : p.award.label}
                </span>
              )}
              {placeChips(p.info, p.amenities).map((c) => <span key={c.key} className={`amen ${c.tone}${c.verified ? " ok" : ""}`} title={c.verified ? "페어링GO가 매장에 확인한 정보" : "Google 지도 정보 — 방문 전 매장에 확인하세요"}>{c.label}</span>)}
            </div>
            <div className="s">
              {p.reviews?.count ? <span className="rv-mini" title={`페어링GO 방문 인증 리뷰 ${p.reviews.count}개 평균`}>★ {p.reviews.avg?.toFixed(1)} ({p.reviews.count})<i>페어링GO</i></span> : null}
              {p.rating && <span className="rating" title={`Google 지도 이용자 평점 ${p.rating.score.toFixed(1)} · 리뷰 ${p.rating.count.toLocaleString("ko-KR")}개`}>{ratingText(p.rating)}<i>Google</i></span>}
              {[p.category, p.distanceKm != null ? `${p.distanceKm.toFixed(1)}km` : null, p.roadAddress || p.address].filter(Boolean).join(" · ")}
            </div>
            {p.info && (
              <div className="pinfo">
                <span className="pv">{verifiedLabel(p.info)}</span>
                {placeNoteLine(p.info) && <span> · {placeNoteLine(p.info)}</span>}
                {!!p.infoView?.drinks.length && <div><b>술</b> {p.infoView.drinks.map((d, i) => <span key={d.id}>{i > 0 && " · "}{d.slug ? <Link href={`/drinks/${d.slug}`}>{d.name}</Link> : d.name}</span>)}</div>}
                {!!p.infoView?.foods.length && <div><b>메뉴</b> {p.infoView?.foods.map((x, i) => <span key={x.id}>{i > 0 && " · "}{x.slug ? <Link href={`/foods/${x.slug}`}>{x.name}</Link> : x.name}</span>)}</div>}
                {p.info.menuNote && <div>{p.info.menuNote}</div>}
                {!!(p.info.menuItems?.length || p.info.drinkItems?.length) && (
                  <details className="pmenu"><summary>메뉴판 보기 <MenuThumbs menu={p.info.menuItems ?? []} drinks={p.info.drinkItems ?? []} /></summary><MenuBoard menu={p.info.menuItems ?? []} drinks={p.info.drinkItems ?? []} /></details>
                )}
              </div>
            )}
            {p.bookable && (
              <div style={{ margin: "9px 0 2px" }}>
                <Link className="btn f sm" href={`/reserve/${p.id}${reserveFood || reserveDrink ? `?${new URLSearchParams({ ...(reserveFood ? { food: reserveFood } : {}), ...(reserveDrink ? { drink: reserveDrink } : {}) })}` : ""}`} onClick={() => track("reserve_click", { ...eventKey, place: p.name })}>예약하기</Link>
                <span className="small muted" style={{ marginLeft: 8 }}>바로 확정 · 페어링GO 파트너</span>
              </div>
            )}
            {p.placeUrl && <a className="lk" href={p.placeUrl} target="_blank" rel="noopener nofollow" onClick={() => track("restaurant_link_click", { ...eventKey, place: p.name, kind: "kakao_map" })}>카카오맵 ↗</a>}
            {p.info?.naverUrl && <a className="lk" href={p.info.naverUrl} target="_blank" rel="noopener nofollow" style={{ marginLeft: 12 }} onClick={() => track("restaurant_link_click", { ...eventKey, place: p.name, kind: "naver_map" })}>네이버 지도 ↗</a>}
            {p.phone && <a className="lk" href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} style={{ marginLeft: 12 }} onClick={() => track("restaurant_link_click", { ...eventKey, place: p.name, kind: "tel" })}>전화</a>}
            {restaurants && !/양조장|리쿼샵/.test(p.category) && <a className="lk br" href={blueRibbonUrl(p.name)} target="_blank" rel="noopener nofollow" style={{ marginLeft: 12 }} onClick={() => track("external_link", { ...eventKey, place: p.name, kind: "blueribbon" })}>블루리본 확인 ↗</a>}
            <Heart kind="place" id={p.id} name={p.name}
              meta={{ name: p.name, address: p.roadAddress || p.address, phone: p.phone ?? undefined, url: p.placeUrl ?? undefined, category: p.category, food: savedAs }} />
          </li>
        ))}
      </ul>
    </>
  );
}
