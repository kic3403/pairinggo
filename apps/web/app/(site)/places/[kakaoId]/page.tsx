/**
 * 매장 상세(2026-09-19) — 모든 식당. 파트너 매장이면 대표 사진(최대 10장)·메뉴판·예약까지.
 * 평점은 둘을 나눠 보인다: 페어링GO(방문 인증 리뷰 평균) · Google(지도 이용자 평가, 캐시).
 * 식당 목록 카드의 이름을 누르면 /places/{카카오id}?n={이름} 으로 온다(카카오는 id로 다시 찾는 API가 없어 이름을 함께 넘긴다).
 */
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { PARTNER_KIND_LABEL, PARTNER_KIND_TONE, placeChips, placeNoteLine, ratingText, REVIEW_VERIFY_LABEL, verifiedLabel } from "@pairinggo/shared";
import { placeDetail as loadDetail } from "@/lib/place-detail";
import { placeReviews } from "@/lib/reviews";
import ExtLink from "../../_components/ExtLink";
import Heart from "../../_components/Heart";
import MenuBoard from "../../_components/MenuBoard";
import RecentTrack from "../../_components/RecentTrack";
import StoreGallery from "./StoreGallery";
import ReviewList from "./ReviewList";

export const dynamic = "force-dynamic";

/** 메타데이터와 본문이 같은 요청에서 한 번만 부르게(카카오·구글 호출) */
const placeDetail = cache((id: string, n?: string) => loadDetail(id, n));

type Props = { params: Promise<{ kakaoId: string }>; searchParams: Promise<{ n?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { kakaoId } = await params;
  const d = await placeDetail(kakaoId, (await searchParams).n).catch(() => null);
  if (!d) return { title: "식당 | 페어링GO", robots: { index: false } };
  const { stats } = await placeReviews(kakaoId, 1);
  const addr = d.place.roadAddress || d.place.address;
  return {
    title: `${d.place.name} | 페어링GO`,
    description: `${d.place.name}${addr ? ` (${addr})` : ""} — ${stats.count ? `방문 인증 리뷰 ${stats.count}개 · 평균 ★${stats.avg}` : "방문 인증 리뷰"}${d.place.info?.menuItems?.length ? " · 메뉴판" : ""}. 전통주와 어울리는 식당을 페어링GO에서.`,
    alternates: { canonical: `/places/${kakaoId}` },
    openGraph: d.place.info?.photos?.[0] ? { images: [d.place.info.photos[0]] } : undefined,
  };
}

export default async function PlaceDetailPage({ params, searchParams }: Props) {
  const { kakaoId } = await params;
  const n = (await searchParams).n;
  const d = await placeDetail(kakaoId, n);
  if (!d) {
    return (
      <div className="wrap">
        <h1>식당을 찾지 못했어요</h1>
        <p className="muted">식당 찾기에서 다시 검색해 주세요.</p>
        <div className="btns"><Link className="btn" href="/places">식당 찾기</Link></div>
      </div>
    );
  }
  const { place: p, bookable, partner, brewery } = d;
  const { stats, reviews } = await placeReviews(kakaoId);
  const info = p.info ?? null;
  const chips = placeChips(info, p.amenities);
  const photos = info?.photos ?? [];
  const addr = p.roadAddress || p.address;
  const writeHref = `/places/${kakaoId}/review?n=${encodeURIComponent(p.name)}`;
  const ev = { place: p.name, kakao: kakaoId };

  return (
    <div className="wrap pd">
      <RecentTrack kind="place" id={kakaoId} name={p.name} meta={addr} href={`/places/${kakaoId}?n=${encodeURIComponent(p.name)}`} />
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/places">식당 찾기</Link> · {p.name}</p>
      {photos.length ? <StoreGallery photos={photos} name={p.name} /> : null}

      <header className="pd-head">
        <div className="pd-title">
          <h1>{p.name}</h1>
          {p.award ? <span className={`award ${p.award.kind}`}>{p.award.kind === "star" ? `★ 미쉐린 ${p.award.year}` : p.award.kind === "bib" ? `빕구르망 ${p.award.year}` : p.award.label}</span> : null}
          {/* 술 상세의 "파트너 양조장"과 같은 인증 도장 — 업종에 맞춰 식당·양조장·리쿼샵 */}
          {partner ? (
            <span className={`seal ${PARTNER_KIND_TONE[d.kind]}`} title="페어링GO가 확인한 파트너 매장">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.4 11.3 3.6 8.5l1-1 1.8 1.8 4.9-4.9 1 1z" /></svg>
              파트너 {PARTNER_KIND_LABEL[d.kind]}
            </span>
          ) : null}
        </div>
        <p className="pd-meta">{[p.category, addr].filter(Boolean).join(" · ")}</p>
        <div className="pd-scores">
          <a href="#reviews" className="pd-score">
            <b>{stats.avg != null ? `★ ${stats.avg.toFixed(1)}` : "★ —"}</b>
            <span>페어링GO 방문 인증 리뷰 {stats.count}</span>
          </a>
          {p.rating ? (
            <span className="pd-score g" title="Google 지도 이용자 평가">
              <b>{ratingText(p.rating)}</b><span>Google 리뷰 {p.rating.count.toLocaleString("ko-KR")}</span>
            </span>
          ) : null}
        </div>
        {chips.length ? (
          <div className="pd-chips">
            {chips.map((c) => <span key={c.key} className={`amen ${c.tone}${c.verified ? " ok" : ""}`} title={c.verified ? "페어링GO가 매장에 확인한 정보" : "Google 지도 정보 — 방문 전 매장에 확인하세요"}>{c.label}</span>)}
          </div>
        ) : null}
        <div className="pd-actions">
          {bookable ? <Link className="btn f" href={`/reserve/${kakaoId}`}>예약하기</Link> : null}
          <Link className={`btn${bookable ? "" : " p"}`} href={writeHref}>리뷰 쓰기</Link>
          {p.phone ? <a className="btn" href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`}>전화</a> : null}
          {p.placeUrl ? <ExtLink className="btn" href={p.placeUrl} event="restaurant_link_click" props={{ ...ev, kind: "kakao_map" }}>카카오맵 ↗</ExtLink> : null}
          {info?.naverUrl ? <ExtLink className="btn" href={info.naverUrl} event="restaurant_link_click" props={{ ...ev, kind: "naver_map" }}>네이버 지도 ↗</ExtLink> : null}
          <Heart kind="place" id={kakaoId} name={p.name} meta={{ name: p.name, address: addr, phone: p.phone ?? undefined, url: p.placeUrl ?? undefined, category: p.category }} />
        </div>
      </header>

      {info ? (
        <section className="pd-sec">
          <h2>매장 정보 <span className="pv">{verifiedLabel(info)}</span></h2>
          {info.menuNote ? <p className="pd-note">{info.menuNote}</p> : null}
          {placeNoteLine(info) ? <p className="small muted">{placeNoteLine(info)}</p> : null}
          {p.infoView?.drinks.length ? <p className="pd-links"><b>술</b> {p.infoView.drinks.map((x, i) => <span key={x.id}>{i > 0 && " · "}{x.slug ? <Link href={`/drinks/${x.slug}`}>{x.name}</Link> : x.name}</span>)}</p> : null}
          {p.infoView?.foods.length && !info.menuItems?.length ? <p className="pd-links"><b>메뉴</b> {p.infoView.foods.map((x, i) => <span key={x.id}>{i > 0 && " · "}{x.slug ? <Link href={`/foods/${x.slug}`}>{x.name}</Link> : x.name}</span>)}</p> : null}
        </section>
      ) : null}

      {brewery && brewery.drinks.length ? (
        <section className="pd-sec">
          <h2>{brewery.name}의 전통주 <span className="muted">{brewery.drinks.length}종</span></h2>
          <ul className="pd-brewery">
            {brewery.drinks.map((x) => (
              <li key={x.id}>
                <Link href={`/drinks/${x.slug}`}>
                  <b>{x.name}</b> <span className="muted small">{[x.category, x.abv != null ? `${x.abv}%` : null].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="muted small">술을 누르면 어울리는 안주와 구매처를 볼 수 있어요.</p>
        </section>
      ) : null}

      {info && (info.menuItems?.length || info.drinkItems?.length) ? (
        <section className="pd-sec">
          <h2>메뉴판</h2>
          <MenuBoard menu={info.menuItems ?? []} drinks={info.drinkItems ?? []} />
        </section>
      ) : null}

      <section className="pd-sec" id="reviews">
        <div className="pd-rev-head">
          <h2>방문 인증 리뷰 <span className="muted">{stats.count}</span></h2>
          <Link className="btn sm p" href={writeHref}>리뷰 쓰기</Link>
        </div>
        <p className="small muted" style={{ margin: "0 0 10px" }}>
          페어링GO 리뷰는 <b>방문을 인증한 회원만</b> 쓸 수 있어요 — {REVIEW_VERIFY_LABEL.reservation}(앱 예약으로 방문 완료) 또는 {REVIEW_VERIFY_LABEL.receipt}(최근 30일 영수증).
        </p>
        <ReviewList kakaoId={kakaoId} reviews={reviews} writeHref={writeHref} />
      </section>
    </div>
  );
}
