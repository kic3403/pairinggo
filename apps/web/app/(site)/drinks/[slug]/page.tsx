/**
 * 전통주 상세 (공개 웹) — "복순도가 안주", "막걸리 어울리는 음식" 같은 검색 유입을 받는 페이지.
 * 서버에서 렌더해 네이버·구글이 읽을 수 있게 한다. 데이터·점수 계산은 packages/shared 공유.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KIND_LABEL, LINK_STATUS, byDrink, breadcrumb, buyLink, confidenceOf, countryLabel, detailCaption, drinkProduct, evidenceNeighbors, guideList, guideRegionOf, extRatingOf, extRatingText, findBySlug, josa, kindOf, naverMapUrl, naverShopUrl, onlineSellable, profileUnknown, similarDrinks, subtypeLabel, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { expertTiersByName } from "@/lib/experts";
import { buyOptions } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { breweryPartner } from "@/lib/place-detail";
import RatingsProvider from "../../_components/RatingsProvider";
import MemberPickButton from "../../_components/MemberPickButton";
import PickTabs from "../../_components/PickTabs";
import { PairingCards, pickCounts } from "../../_components/PairingCards";
import { capItems, drinkItems } from "@/lib/detail-items";
import { recsForDrink } from "@/lib/partner-recs";
import PartnerRecs from "../../_components/PartnerRecs";
import ExtLink from "../../_components/ExtLink";
import BuyBox from "../../_components/BuyBox";
import CardDownload from "../../_components/CardDownload";
import CopyButton from "../../_components/CopyButton";
import { drinkShare } from "@/lib/detail-share";
import Heart from "../../_components/Heart";
import NearbyPlaces from "../../_components/NearbyPlaces";
import DetailActionBar from "../../_components/DetailActionBar";
import JsonLd from "../../_components/JsonLd";
import ProfileBars from "../../_components/ProfileBars";
import ShareButton from "../../_components/ShareButton";
import WeatherPick from "../../_components/WeatherPick";
import SpecPicker from "../../_components/SpecPicker";
import KindFacts from "../../_components/KindFacts";
import DetailMedia, { KIND_TONE } from "../../_components/DetailMedia";
import DrinkReviews from "../../_components/DrinkReviews";
import RecentTrack from "../../_components/RecentTrack";
import { drinkReviewSummary } from "@/lib/drink-reviews";

export const revalidate = 600;
/**
 * 빌드 때 카탈로그의 모든 술 페이지와 공유 이미지(opengraph-image.tsx)를 미리 만든다(2026-09-15).
 * 없으면 상세·공유 이미지가 첫 요청 때 생성돼 3초 넘게 걸리고, 카카오 링크 미리보기 스크래퍼가 그림을 못 받았다(docs/20 P0-1).
 * 새로 넣은 술(빌드 뒤 발행)은 첫 요청 때 만들어진다(dynamicParams 기본값).
 */
export async function generateStaticParams() {
  const c = await getCatalog();
  return c.dataset.drinks.map((x) => ({ slug: toSlug(x.name) }));
}

async function load(slug: string) {
  const c = await getCatalog();
  const drink = findBySlug(c.dataset.drinks, slug, (d) => d.name);
  return { c, drink };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { drink } = await load((await params).slug);
  if (!drink) return { title: "찾을 수 없는 전통주 | 페어링GO" };
  const n = (byDrink[drink.id] || []).length;
  const title = `${drink.name}에 어울리는 안주 ${n}가지 | 페어링GO`;
  const description = `${josa(drink.name, "과/와")} 어울리는 음식을 추천합니다. ${[kindOf(drink) === "trad" ? drink.category : `${KIND_LABEL[kindOf(drink)]} ${subtypeLabel(drink)}`, drink.abv != null ? `${drink.abv}%` : null, drink.brewery].filter(Boolean).join(" · ")}.`;
  const url = `/drinks/${toSlug(drink.name)}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article", siteName: "페어링GO" },
  };
}

export default async function DrinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { c, drink } = await load((await params).slug);
  if (!drink) notFound();

  // 카드는 앞쪽 40장만 싣고 나머지는 /drinks/[slug]/all(2026-09-30, lib/detail-items.ts)
  const [allItems, recs] = await Promise.all([drinkItems(drink), recsForDrink(drink.id).catch(() => [])]);
  const { items } = capItems(allItems);
  const tiers = await expertTiersByName();

  const bl = buyLink(drink);
  const sellable = onlineSellable(drink);
  const offline = drink.offline;
  // 이 술을 빚은 양조장이 페어링GO 파트너면 방문 시음 예약으로 잇는다(0031)
  const bp = drink.brewery ? await breweryPartner(drink.brewery).catch(() => null) : null;
  const sameBrewery = c.dataset.drinks.filter((d) => d.id !== drink.id && d.brewery && d.brewery === drink.brewery).slice(0, 5);
  const kind = kindOf(drink);
  const sameRegion = kind === "trad" ? c.dataset.drinks.filter((d) => d.id !== drink.id && d.region && drink.region && d.region.split(" ")[0] === drink.region.split(" ")[0]).slice(0, 6) : [];
  // 유사한 술 — 같은 주종 안에서(맛 프로필·종류·도수, shared similarDrinks)
  const similar = similarDrinks(drink, 14).filter((s) => kindOf(s.x) === kind && !sameBrewery.some((b) => b.id === s.x.id)).slice(0, 5);
  // 근거(양조장·소믈리에·매체·후기·회원) 있는 페어링이 하나도 없으면 '준비 중'으로 알린다 — 맛 분석·AI 제안을 검증된 추천처럼 보이지 않게
  const hasEvidence = items.some((it) => ["official", "sommelier", "media", "blog", "user"].includes(it.pairing.src ?? ""));
  // 근거가 없으면 같은 양조장 술·비슷한 술 가운데 근거가 확인된 것을 본문 위로(2026-10-01, shared pairing/neighbors.ts) — 이 술 등급에는 넣지 않는다
  const foodById = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const neighbors = hasEvidence ? [] : evidenceNeighbors(
    [
      ...c.dataset.drinks.filter((d) => d.id !== drink.id && d.brewery && d.brewery === drink.brewery).map((d) => ({ drink: d, rel: "brewery" as const })),
      ...similarDrinks(drink, 20).filter((s) => kindOf(s.x) === kind).map((s) => ({ drink: s.x, rel: "similar" as const, why: s.why.slice(0, 2) })),
    ],
    (id) => byDrink[id], (id) => foodById.get(id), 4, 2,
  );
  const shown = new Set(neighbors.map((x) => x.drink.id));

  const meta = kind === "trad"
    ? [drink.category, drink.abv != null ? `${drink.abv}%` : null, drink.region, drink.brewery].filter(Boolean)
    : [KIND_LABEL[kind], subtypeLabel(drink), countryLabel(kind, drink.country), drink.abv != null ? `${drink.abv}%` : null, drink.brewery].filter(Boolean);

  // 구조화 데이터(docs/20 P3-4) — 검색 결과에 도수·양조장·경로가 함께 보이게. 파는 상품이 있으면 가격까지.
  const base = siteUrl();
  const path = `/drinks/${toSlug(drink.name)}`;
  const [opts, rv] = await Promise.all([buyOptions(drink.id).catch(() => []), drinkReviewSummary(drink.id).catch(() => ({ n: 0, avg: null, hist: [0, 0, 0, 0, 0] as [number, number, number, number, number] }))]);   // 회원 평가 요약(docs/25)
  const ld = [
    drinkProduct(
      { name: drink.name, desc: drink.desc, category: kind === "trad" ? drink.category : `${KIND_LABEL[kind]} ${subtypeLabel(drink)}`, abv: drink.abv, brewery: drink.brewery, region: kind === "trad" ? drink.region : countryLabel(kind, drink.country), awards: drink.awards },
      { base, path, offers: opts.map((o) => ({ price: o.price, inStock: o.buyable > 0, sellerName: o.seller.bizName })), rating: { avg: rv.avg, count: rv.n } },
    ),
    breadcrumb([{ name: "홈", path: "/" }, { name: "주류", path: "/drinks" }, { name: KIND_LABEL[kind], path: `/drinks?kind=${kind}` }, { name: drink.name, path }], base),
  ];

  const rating = extRatingOf(drink);
  const share = drinkShare(drink);
  // 상태 칩(2026-10-03 UI 리뉴얼 — 캐치테이블의 주차·콜키지 칩 자리): 찰떡 조합 수 · 근거 확인 수 · 전문가 추천 · 주간 순위
  const nBest = allItems.filter((i) => i.grade.key === "best").length, nConf = allItems.filter((i) => confidenceOf(i.pairing) === "confirmed").length;
  const hasExpert = allItems.some((i) => (i.pairing.xp?.yes ?? 0) >= 2);
  const weekRank = drink.trend?.rank ?? null;
  // 이 술 종류의 모음 화면(막걸리 안주 추천 등, shared seo/guides.ts) — 있으면 옆 칸에서 잇는다
  const guides = guideList(c.dataset).filter((g) => g.side === "drink" && ((g.by === "category" && g.category === drink.category) || (g.by === "region" && g.category === guideRegionOf(drink))));
  // 본문 '가까운 술'에 나온 술은 옆 칸에서 뺀다(한 화면에 두 번 두지 않기)
  const asideBrewery = sameBrewery.filter((d) => !shown.has(d.id)), asideSimilar = similar.filter((x) => !shown.has(x.x.id));
  const hasRelated = asideBrewery.length > 0 || asideSimilar.length > 0 || sameRegion.length > 0;

  return (
    <div className="wrap detail">
      <JsonLd data={ld} />
      <RecentTrack kind="drink" id={drink.id} name={drink.name} meta={meta.slice(0, 3).join(" · ")} href={path} />
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/drinks">주류</Link> · <Link href={`/drinks?kind=${kind}`}>{KIND_LABEL[kind]}</Link></p>

      {/* ① 핵심 정보 한 카드(2026-09-25 정리) — 이름 · 분류 · 외부 평점 · 태그 · 저장/공유, 오른쪽에 사진 칸(2026-09-26, 없으면 주종 색 타일) */}
      {/* UI 리뉴얼(2026-10-03, 시안): 사진이 먼저 크게, 이름·별점·분류, 상태 칩, 탭 */}
      <header className="dhead dhead-v2">
        <DetailMedia kind="drink" image={drink.image} name={drink.name} label={kind === "trad" ? drink.category : subtypeLabel(drink)} tone={KIND_TONE[kind]} />
        <div className="dhead-body">
          <div className="dh-top">
            <h1>{drink.name}{drink.demo && <span className="badge n" style={{ marginLeft: 8, verticalAlign: "middle" }}>데모</span>}</h1>
            {bp && <span className="seal food dh-seal" title="페어링GO가 확인한 파트너 양조장"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.4 11.3 3.6 8.5l1-1 1.8 1.8 4.9-4.9 1 1z" /></svg>파트너 양조장</span>}
          </div>
          {drink.nameOrig && <p className="name-orig">{drink.nameOrig}</p>}
          <div className="meta">{meta.map((m, i) => <span key={i}>{i > 0 && <span className="muted"> · </span>}{m}</span>)}</div>
          {/* 외부 평점 — 허용된 출처(라이선스·수입사 제공)만, 출처·확인일과 함께. 페어링GO 회원 평가와 섞지 않는다 */}
          {/* 회원 평가(docs/25) — 외부 평점·근거 등급과 줄을 따로 두고 "회원" 표기. 3명부터 평균, 그 전엔 남기기 안내 */}
          <p className="member-stars"><a href="#reviews">{rv.avg != null ? <><b>★ {rv.avg.toFixed(1)}</b> <span className="muted small">회원 평가 {rv.n}명</span></> : <span className="muted small">{rv.n > 0 ? `회원 평가 ${rv.n}명 · 평가 남기기` : "회원 평가 남기기 ★"}</span>}</a></p>
          {rating && <p className="ext-rating-line"><span className="ext-rating">★ {rating.score}<i>{rating.source}</i></span> <span className="small muted">{extRatingText(rating)} · {rating.checked} 확인{rating.url ? <> · <ExtLink href={rating.url} event="external_link" props={{ d: drink.id, kind: "ext_rating" }}>출처 보기 ↗</ExtLink></> : null}</span></p>}
          {(!!drink.flavor?.length || !!drink.awards?.length) && (
            <ul className="tags">{drink.flavor.map((f) => <li key={f} className="tag">{f}</li>)}{(drink.awards ?? []).map((a) => <li key={a} className="tag f">{a}</li>)}</ul>
          )}
          <div className="dhead-acts">
            <span className="bar-dup"><Heart kind="drink" id={drink.id} name={drink.name} variant="button" /></span>
            <ShareButton className="btn xs" title={`${drink.name}에 어울리는 음식 ${items.length}가지`} text={`${josa(drink.name, "과/와")} 어울리는 음식을 추천 — 페어링GO`} d={drink.id} />
          </div>
        </div>
      </header>
      {drink.desc && <p className="lead">{drink.desc}</p>}
      <ul className="dstat" aria-label="한눈에">
        {nBest > 0 && <li>찰떡 조합 {nBest}</li>}
        {nConf > 0 && <li>근거 확인 {nConf}</li>}
        {hasExpert && <li>전문가 추천</li>}
        {weekRank && weekRank <= 50 && <li>주간 {weekRank}위</li>}
        {sellable ? <li>온라인 구매 가능</li> : <li>온라인 판매 불가</li>}
      </ul>
      <nav className="dtabs" aria-label="화면 안 이동">
        <a href="#pairings" className="on">페어링</a><a href="#taste">Tasting Note</a><a href="#buy">구매</a><a href="#reviews">평가{rv.n ? ` ${rv.n}` : ""}</a>{bp && <a href="#brewery">양조장</a>}
      </nav>

      {/* ② 용량 선택과 그 규격의 참고가격(2026-09-24) — 규격이 등록된 술만. useSearchParams라 Suspense 경계 */}
      {!!drink.specs?.length && <Suspense fallback={null}><SpecPicker specs={drink.specs} drinkId={drink.id} /></Suspense>}
      {/* 파는 곳이 있으면 이름 바로 아래에서 산다(2026-09-21 사용자 요청) — 재고·가격이 바뀌므로 화면에서 불러온다 */}
      <BuyBox drinkId={drink.id} drinkName={drink.name} />

      {/* ③ 구매 — 페어링GO는 판매자가 아니라 판매처로 안내한다. 판매점 찾기는 접어 두고 누르면 펼친다(온라인 불가 주류는 펼쳐 둠) */}
      <section className="buy" id="buy">
        <h3>{sellable ? "온라인 구매" : "구매 안내"}</h3>
        <div className="btns" style={{ marginTop: 6 }}>
          {sellable && !bl.fallback && (
            <>
              <ExtLink className="btn p bar-dup" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink" }}>{bl.store}로 이동 ↗</ExtLink>
              <ExtLink className="btn" href={naverShopUrl(drink.name)} event="external_link" props={{ d: drink.id, kind: "naver_shop" }}>네이버쇼핑에서 찾기 ↗</ExtLink>
            </>
          )}
          {sellable && bl.fallback && <ExtLink className="btn p bar-dup" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink_fallback" }}>네이버쇼핑에서 찾기 ↗</ExtLink>}
          {!sellable && <ExtLink className="btn" href={naverShopUrl(drink.name)} event="external_link" props={{ d: drink.id, kind: "naver_shop_info" }}>네이버쇼핑에서 정보 보기 ↗</ExtLink>}
        </div>
        <p className="small muted" style={{ margin: "8px 0 0" }}>
          {!sellable ? "전통주가 아니라 온라인 직배송이 법적으로 제한됩니다 — 아래에서 가까운 판매점을 찾아 주세요. "
            : bl.fallback ? `공식 판매 링크가 최근 점검(${LINK_STATUS.checkedAt?.slice(0, 10) || "점검"})에서 응답하지 않아 네이버쇼핑으로 안내합니다. `
            : bl.soldout ? "최근 점검에서 품절 문구가 감지됐습니다 — 재입고는 판매처에서 확인해 주세요. " : ""}
          주류는 만 19세 이상만 구매할 수 있습니다.
        </p>
        {offline && (offline.visit === true || offline.address) && (
          <div className="box" style={{ margin: "12px 0 0" }}>
            <h3>{offline.place || drink.brewery} {offline.visit === true && <span className="badge o">현장 판매 확인</span>}</h3>
            {offline.address && <p className="small" style={{ margin: "0 0 4px" }}>{offline.address}</p>}
            {offline.note && <p className="small muted" style={{ margin: 0 }}>{offline.note}</p>}
            <div className="btns" style={{ marginTop: 10 }}>
              <ExtLink className="btn" href={naverMapUrl(offline.address || `${drink.brewery} ${drink.region || ""}`)} event="external_link" props={{ d: drink.id, kind: "brewery_map" }}>길찾기 ↗</ExtLink>
              {offline.phone && <a className="btn" href={`tel:${offline.phone.replace(/[^0-9+]/g, "")}`}>전화 {offline.phone}</a>}
            </div>
          </div>
        )}
        <details className="fold" open={!sellable}>
          <summary>내 주변 판매점 찾기</summary>
          <NearbyPlaces mode="bottleshops" drinkName={drink.name} drinkId={drink.id} trad={sellable} />
        </details>
      </section>

      <div className="cols" style={{ marginTop: 8 }}>
        <div>
          <h2 id="pairings">{josa(drink.name, "과/와")} 어울리는 음식 {items.length}가지</h2>
          <details className="fold small">
            <summary>어울림 등급은 어떻게 매기나요</summary>
            <p className="small muted">어울림 등급은 <b>근거가 먼저</b>입니다. 양조장·소믈리에 추천이 있거나 서로 다른 출처가 여럿 확인한 조합만 ‘근거 확인’이 되고, 그중 어울림 점수(근거 강도 60% · 맛 분석 25% · 블로그 언급 15%)가 높은 조합이 <b>찰떡</b>, 나머지가 <b>잘 어울림</b>입니다. 블로그·매체 한 곳뿐인 조합은 ‘근거 약함’, 근거 글 없이 맛 프로필로 계산한 조합은 ‘추정’이라 늘 <b>시도해 볼 만</b>으로 둡니다. 같은 매체·같은 블로그·같은 사람은 한 곳으로 세고, 같은 조합은 술 화면과 음식 화면에서 같은 등급입니다.</p>
          </details>
          {!hasEvidence && <p className="box small" style={{ marginBottom: 12 }}><b>페어링 정보 준비 중</b> — 아직 양조장·소믈리에·매체가 확인한 조합이 없습니다. 아래 카드는 맛 프로필로 추정한 조합이며 검증된 추천이 아닙니다.</p>}
          {neighbors.length > 0 && (
            <section className="box neighbors" aria-labelledby="neighbors-h">
              <h3 id="neighbors-h">근거가 확인된 가까운 술</h3>
              <p className="small muted">{drink.brewery && neighbors.some((x) => x.rel === "brewery") ? `${drink.brewery}의 다른 술과 ` : ""}맛이 비슷한 {josa(KIND_LABEL[kind], "은/는")} 이런 음식과 확인됐어요. 이 술에도 참고해 보세요.</p>
              <ul>
                {neighbors.map((x) => (
                  <li key={x.drink.id}>
                    <div className="nb-top">
                      <Link href={`/drinks/${toSlug(x.drink.name)}`}><b>{x.drink.name}</b></Link>
                      <span className="small muted">{x.rel === "brewery" ? "같은 양조장" : ["비슷한 술", ...x.why].join(" · ")}</span>
                    </div>
                    <div className="nb-foods">
                      {x.foods.map((f) => <Link key={f.food.id} className="nb-chip" href={`/foods/${toSlug(f.food.name)}?d=${x.drink.id}`}>{f.food.name}<span className="small muted"> · {f.conf === "confirmed" ? "근거 확인" : "근거 약함"}</span></Link>)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* 오늘 같은 날엔 — 사는 곳 날씨에 맞는 이 술의 음식(docs/29). 아래 카드 순위는 그대로 */}
          <WeatherPick mode="drink" id={drink.id} />
          <MemberPickButton mode="drink" subjectId={drink.id} subjectName={drink.name} options={c.dataset.foods.map((f) => ({ id: f.id, name: f.name }))} />
          <RatingsProvider subject={{ drink: drink.id }}>
            <PickTabs counts={pickCounts(allItems)} loaded={items.length} moreHref={`/drinks/${toSlug(drink.name)}/all`}>
              <PairingCards items={items} tiers={tiers} />
            </PickTabs>
          </RatingsProvider>
          {/* ④ Tasting Note · 주종별 정보 — 페어링 아래(2026-10-03 시안 순서) */}
          <div className="dinfo" id="taste">
            <ProfileBars kind="drink" profile={drink.profile} unknown={profileUnknown(drink.attrs)} />
            <KindFacts drink={drink} />
          </div>
          <PartnerRecs recs={recs} title="양조장·식당이 추천한 안주" hideDrink note="파트너가 직접 추천했지만 위 목록에는 아직 없는 음식이에요." />
          {/* SNS에 올리기(2026-10-02) — 이 술의 그림 카드(1080×1350)와 붙여 넣을 글. lib/detail-share.ts */}
          <section className="box sns-kit">
            <h3>SNS에 올리기</h3>
            <p className="small muted">이 술에 어울리는 음식 3가지를 그림 한 장과 글로 받아 인스타·블로그에 올릴 수 있어요.</p>
            <div className="btns">
              <CardDownload href={`${path}/card.png`} filename={`pairinggo-${toSlug(drink.name)}.png`} from="drink" className="btn" />
              <CopyButton text={detailCaption({ side: "drink", ...share, base })} label="글 복사" />
            </div>
          </section>
          {/* 회원 별점·한 줄(docs/25) — 조합 평가(먹어봤어요)와 별개, 술 자체의 평가 */}
          <DrinkReviews drinkId={drink.id} drinkName={drink.name} initial={rv} />
        </div>

        <aside>
          {bp && (
            <div className="box" id="brewery">
              <h3 className="with-seal">
                {drink.brewery} 방문하기
                {/* 인증 도장처럼 — 페어링GO가 확인한 파트너 양조장(0031) */}
                <span className="seal food" title="페어링GO가 확인한 파트너 양조장">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.4 11.3 3.6 8.5l1-1 1.8 1.8 4.9-4.9 1 1z" /></svg>
                  파트너 양조장
                </span>
              </h3>
              {bp.address ? <p className="small">{bp.address}</p> : null}
              <div className="btns">
                {bp.bookable && <Link className="btn p" href={`/reserve/${bp.kakaoId}`}>방문 시음 예약</Link>}
                <Link className="btn" href={`/places/${bp.kakaoId}?n=${encodeURIComponent(bp.name)}`}>양조장 보기</Link>
              </div>
            </div>
          )}
          {guides.map((g) => <p key={g.slug} className="guide-go"><Link href={`/guide/${g.slug}`}>{g.h1} 모음 →</Link></p>)}
          {/* ⑦ 관련 술 — 한 칸에(같은 양조장 · 비슷한 술 · 같은 지역). '데이터' 칸은 뺐다(2026-09-25) */}
          {hasRelated && (
            <div className="box related">
              <h3>관련 술</h3>
              {asideBrewery.length > 0 && <><h4>{drink.brewery}의 다른 술</h4><ul>{asideBrewery.slice(0, 4).map((d) => <li key={d.id}><Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link></li>)}</ul></>}
              {asideSimilar.length > 0 && <><h4>비슷한 {KIND_LABEL[kind]}</h4><ul>{asideSimilar.slice(0, 4).map((x) => <li key={x.x.id}><Link href={`/drinks/${toSlug(x.x.name)}`}>{x.x.name}</Link>{x.why.length > 0 && <span className="small muted"> · {x.why.slice(0, 2).join(" · ")}</span>}</li>)}</ul></>}
              {sameRegion.length > 0 && <><h4>{drink.region?.split(" ")[0]}의 전통주</h4><ul>{sameRegion.slice(0, 4).map((d) => <li key={d.id}><Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link></li>)}</ul></>}
            </div>
          )}
        </aside>
      </div>
      <DetailActionBar save={<Heart kind="drink" id={drink.id} name={drink.name} variant="button" />}>
        {sellable && !bl.fallback && <ExtLink className="btn ab-buy" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink_bar" }}>공식몰 구매</ExtLink>}
        {sellable && bl.fallback && <ExtLink className="btn ab-buy" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink_bar_fallback" }}>네이버쇼핑</ExtLink>}
        {!sellable && <a className="btn ab-buy" href="#buy">구매 안내</a>}
        <a className="btn p ab-main-cta" href="#places">파는 곳 찾기</a>
      </DetailActionBar>
    </div>
  );
}
