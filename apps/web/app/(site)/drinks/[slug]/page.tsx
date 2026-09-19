/**
 * 전통주 상세 (공개 웹) — "복순도가 안주", "막걸리 어울리는 음식" 같은 검색 유입을 받는 페이지.
 * 서버에서 렌더해 네이버·구글이 읽을 수 있게 한다. 데이터·점수 계산은 packages/shared 공유.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { F, LINK_STATUS, byDrink, buyLink, findBySlug, josa, naverMapUrl, naverShopUrl, onlineSellable, scorePairings, toSlug, fmt, explainOverall, SRC_LABEL } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import RatingsProvider from "../../_components/RatingsProvider";
import MemberPickButton from "../../_components/MemberPickButton";
import PickTabs from "../../_components/PickTabs";
import { PairingCards, pickCounts, foodHref, type CardItem } from "../../_components/PairingCards";
import ExtLink from "../../_components/ExtLink";
import Heart from "../../_components/Heart";
import NearbyPlaces from "../../_components/NearbyPlaces";
import DetailActionBar from "../../_components/DetailActionBar";
import ProfileBars from "../../_components/ProfileBars";
import ShareButton from "../../_components/ShareButton";

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
  const description = `${josa(drink.name, "과/와")} 어울리는 음식을 양조장·소믈리에·전문 매체 근거와 함께 정리했습니다. ${[drink.category, drink.abv != null ? `${drink.abv}%` : null, drink.brewery].filter(Boolean).join(" · ")}.`;
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

  const rows = byDrink[drink.id] || [];
  const scored = scorePairings(rows, (p) => F[p.f]?.category || "");
  const items: CardItem[] = scored.map((s) => {
    const food = F[s.p.f];
    // 음식 화면으로 넘어갈 때 이 술을 들고 간다(?d=) — 맛집 목록이 이 술과 그 음식을 함께 파는 식당을 먼저 보여 준다
    return { href: `${foodHref(food?.name || s.p.f)}?d=${drink.id}`, name: food?.name || s.p.f, sub: food?.tags?.slice(0, 3).join(" · "), grade: s.grade, explain: explainOverall(s, SRC_LABEL[s.p.src ?? "profile"]), pairing: s.p };
  });

  const bl = buyLink(drink);
  const sellable = onlineSellable(drink);
  const offline = drink.offline;
  const sameBrewery = c.dataset.drinks.filter((d) => d.id !== drink.id && d.brewery && d.brewery === drink.brewery).slice(0, 5);
  const sameRegion = c.dataset.drinks.filter((d) => d.id !== drink.id && d.region && drink.region && d.region.split(" ")[0] === drink.region.split(" ")[0]).slice(0, 6);

  const meta = [drink.category, drink.abv != null ? `${drink.abv}%` : null, drink.region, drink.brewery].filter(Boolean);

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/drinks">전통주</Link></p>
      <h1>{drink.name}</h1>
      <div className="meta">{meta.map((m, i) => <span key={i}>{i > 0 && <span className="muted"> · </span>}{m}</span>)}</div>
      {drink.desc && <p className="lead">{drink.desc}</p>}
      {!!drink.flavor?.length && (
        <ul className="tags">{drink.flavor.map((f) => <li key={f} className="tag">{f}</li>)}</ul>
      )}
      {!!drink.awards?.length && (
        <ul className="tags">{drink.awards.map((a) => <li key={a} className="tag f">{a}</li>)}</ul>
      )}
      <ProfileBars kind="drink" profile={drink.profile} />
      <div className="share-row"><ShareButton className="btn xs" title={`${drink.name}에 어울리는 음식 ${items.length}가지`} text={`${josa(drink.name, "과/와")} 어울리는 음식을 근거와 함께 — 페어링GO`} d={drink.id} /></div>

      {/* 구매 — 페어링GO는 판매자가 아니라 판매처로 안내한다 */}
      <section className="buy">
        <h3>온라인 구매</h3>
        <div className="btns" style={{ marginTop: 6 }}>
          {sellable && !bl.fallback && (
            <>
              <ExtLink className="btn p" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink" }}>{bl.store}로 이동 ↗</ExtLink>
              <ExtLink className="btn" href={naverShopUrl(drink.name)} event="external_link" props={{ d: drink.id, kind: "naver_shop" }}>네이버쇼핑에서 찾기 ↗</ExtLink>
            </>
          )}
          {sellable && bl.fallback && <ExtLink className="btn p" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink_fallback" }}>네이버쇼핑에서 찾기 ↗</ExtLink>}
          {!sellable && <ExtLink className="btn" href={naverShopUrl(drink.name)} event="external_link" props={{ d: drink.id, kind: "naver_shop_info" }}>네이버쇼핑에서 정보 보기 ↗</ExtLink>}
          <Heart kind="drink" id={drink.id} name={drink.name} variant="button" />
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {!sellable && "이 술은 전통주로 분류되지 않아 온라인 직배송이 법적으로 제한됩니다. 아래에서 가까운 판매점을 찾아 주세요. "}
          {sellable && bl.fallback && `공식 판매 링크가 최근 점검(${LINK_STATUS.checkedAt?.slice(0, 10) || "점검"})에서 응답하지 않아 네이버쇼핑으로 안내합니다. `}
          {sellable && bl.soldout && "최근 점검에서 품절 문구가 감지됐습니다. 재입고는 판매처에서 확인해 주세요. "}
          {sellable && "주류는 만 19세 이상만 구매할 수 있습니다."}
        </p>
        {offline && (offline.visit === true || offline.address) && (
          <div className="box" style={{ marginTop: 12 }}>
            <h3>{offline.place || drink.brewery} {offline.visit === true && <span className="badge o">현장 판매 확인</span>}</h3>
            {offline.address && <p className="small" style={{ margin: "0 0 4px" }}>{offline.address}</p>}
            {offline.note && <p className="small muted" style={{ margin: 0 }}>{offline.note}</p>}
            <div className="btns" style={{ marginTop: 10 }}>
              <ExtLink className="btn" href={naverMapUrl(offline.address || `${drink.brewery} ${drink.region || ""}`)} event="external_link" props={{ d: drink.id, kind: "brewery_map" }}>길찾기 ↗</ExtLink>
              {offline.phone && <a className="btn" href={`tel:${offline.phone.replace(/[^0-9+]/g, "")}`}>전화 {offline.phone}</a>}
            </div>
          </div>
        )}
      </section>

      <div className="cols" style={{ marginTop: 8 }}>
        <div>
          {/* 파는 곳 찾기는 페어링 목록 위에 — 온라인 구매 바로 아래(음식 상세의 맛집 칸과 같은 자리) */}
          <NearbyPlaces mode="bottleshops" drinkName={drink.name} drinkId={drink.id} trad={sellable} />
          <h2 id="pairings">{josa(drink.name, "과/와")} 어울리는 음식 {items.length}가지</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            어울림 등급(찰떡 · 잘 어울림 · 시도해 볼 만)은 전문가 평가(60%)·블로그 언급량(25%)·맛 프로필(15%)에 출처 등급을 더한 점수로 매깁니다. 같은 조합은 술 화면과 음식 화면에서 같은 등급입니다. 전문가픽은 양조장·소믈리에 추천, 대중픽은 블로그·유튜브 후기에서 확인된 조합이고, 먹어본 회원들의 평가가 함께 쌓입니다.
          </p>
          <MemberPickButton mode="drink" subjectId={drink.id} subjectName={drink.name} options={c.dataset.foods.map((f) => ({ id: f.id, name: f.name }))} />
          <RatingsProvider subject={{ drink: drink.id }}>
            <PickTabs counts={pickCounts(items)}>
              <PairingCards items={items} />
            </PickTabs>
          </RatingsProvider>
        </div>

        <aside>
          {!!sameBrewery.length && (
            <div className="box">
              <h3>{drink.brewery}의 다른 술</h3>
              <ul>{sameBrewery.map((d) => <li key={d.id}><Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link></li>)}</ul>
            </div>
          )}
          {!!sameRegion.length && (
            <div className="box">
              <h3>{drink.region?.split(" ")[0]}의 전통주</h3>
              <ul>{sameRegion.map((d) => <li key={d.id}><Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link></li>)}</ul>
            </div>
          )}
          <div className="box">
            <h3>데이터</h3>
            <ul>
              <li>블로그 언급 {fmt(drink.blog_anju || 0)}건</li>
              <li>등록된 페어링 {items.length}건</li>
              <li>전체 전통주 {c.counts.drinks}종</li>
            </ul>
          </div>
        </aside>
      </div>
      <DetailActionBar save={<Heart kind="drink" id={drink.id} name={drink.name} variant="button" />}>
        <a className="btn" href="#pairings">어울리는 음식 {items.length}</a>
        {sellable && !bl.fallback && <ExtLink className="btn p" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink_bar" }}>공식몰 구매 ↗</ExtLink>}
        {sellable && bl.fallback && <ExtLink className="btn p" href={bl.url} event="buy_link_click" props={{ d: drink.id, store: bl.store, from: "drink_bar_fallback" }}>네이버쇼핑 ↗</ExtLink>}
        {!sellable && <a className="btn p" href="#places">파는 곳 찾기</a>}
      </DetailActionBar>
    </div>
  );
}
