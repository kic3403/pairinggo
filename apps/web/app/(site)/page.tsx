/**
 * 홈(2026-09-25 재구성, 캐치테이블·데일리샷 구조 참고 — docs/24) — 위에서부터
 *  ① 헤더(로고 + 전폭 검색창) ② 홈 탭(전통주·위스키·사케·와인·음식·수상·핫한 페어링) ③ 지역 줄 ④ 배너 캐러셀(리포트·이달의 파트너·이벤트)
 *  ⑤ 아이콘 10칸 ⑥ 서비스 타일 4장 ⑦ 파트너 매장 줄 ⑧ 많이 찾는 전통주(정지 카드) ⑨ 음식 종류 칩 ⑩ 회원 추천 ⑪ 안주로 찾기
 * 히어로 문장·숫자·흘러가는 마키·큰 버튼은 뺐다(사용자 결정). 검색 유입을 위한 한 줄 소개만 배너 위에.
 */
import type { Metadata } from "next";
import Link from "next/link";
import HomeTabs from "./_components/HomeTabs";
import HomeBanners from "./_components/HomeBanners";
import PartnerRow from "./_components/PartnerRow";
import TrendRow from "./_components/TrendRow";
import TriedPill from "./_components/TriedPill";
import QuickMenu from "./_components/QuickMenu";
import PickFeed from "./_components/PickFeed";
import FoodCircles from "./_components/FoodCircles";
import BestPairings from "./_components/BestPairings";
import JsonLd from "./_components/JsonLd";
import { loadAwards } from "@/lib/awards";
import { homeCards } from "@/lib/banners";
import { listPosts } from "@/lib/member-picks";
import { topDrinks } from "@/lib/popular";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import { BRAND_ALT_NAMES, BRAND_NAME, POPULAR_FOODS, homePicksMode, organization, website } from "@pairinggo/shared";

export const revalidate = 600;

export const metadata: Metadata = {
  // 링크 공유(카카오톡·문자) 미리보기 문구 — 2026-09-14 사용자 결정. openGraph를 함께 둬야 카카오가 이 문구를 쓴다
  // 검색 결과 제목·설명에는 한글 표기 "페어링고"를 함께 적는다(2026-10-02 — 사람들은 한글로 검색한다). 공유 미리보기(openGraph)는 그대로
  title: "페어링GO(페어링고) — 맛있는 술과 어울리는 맛있는 음식은?",
  description: "페어링고(페어링GO)는 전통주·위스키·사케·와인에 어울리는 음식을 추천합니다. 음식을 고르면 어울리는 술도 찾아 줍니다.",
  alternates: { canonical: "/", types: { "application/rss+xml": [{ url: "/rss.xml", title: "페어링GO 오늘의 페어링" }] } },
  openGraph: { title: "페어링GO — 맛있는 술과 어울리는 맛있는 음식은?", description: "술을 고르면 어울리는 음식을, 음식을 고르면 어울리는 술을 찾아 줍니다.", url: "/", siteName: "페어링GO", type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "페어링GO" }] },
};

export default async function Home() {
  const c = await getCatalog();
  const [top, awards, picks, home] = await Promise.all([
    Promise.resolve(topDrinks(c.dataset, 10)), loadAwards(), listPosts(4).catch(() => []), homeCards(),
  ]);
  const picksMode = homePicksMode(picks.length);   // 글이 3건 미만이면 큰 칸 대신 작은 초대 카드(docs/20 P0-5)
  const foods = (POPULAR_FOODS.length ? POPULAR_FOODS : c.dataset.foods).slice(0, 10);

  return (
    <div className="wrap home">
      {/* 사이트 이름과 사이트 안 검색 — 구글 결과에 검색창이 붙을 수 있다(docs/20 P3-4) */}
      {/* 이름의 다른 표기(페어링고·pairinggo)와 서비스 소개 정보 — 한글 "페어링고"로 검색해도 같은 곳으로 알게(2026-10-02) */}
      <JsonLd data={[
        website({ base: siteUrl(), name: BRAND_NAME, alternateName: BRAND_ALT_NAMES }),
        organization({ base: siteUrl(), name: BRAND_NAME, alternateName: BRAND_ALT_NAMES, logoPath: "/icon-512.png", description: "술을 고르면 어울리는 음식을, 음식을 고르면 어울리는 술을 추천하는 서비스" }),
      ]} />
      {/* UI 리뉴얼(2026-10-03, 시안 캔버스): 글은 제목·이름만, 그림·버튼으로. 한 줄 소개는 검색봇용으로만 남긴다 */}
      <h1 className="home-h1 sr-only">맛있는 술엔 맛있는 음식 — 술을 고르면 어울리는 음식을, 음식을 고르면 어울리는 술을 추천!</h1>
      <HomeTabs />
      {/* 큰 배너 — 첫 장은 사는 곳 날씨·계절 카드(docs/29), 그 뒤 이벤트·이달의 파트너·리포트 */}
      <HomeBanners cards={home.cards} weather />
      <QuickMenu michelinYear={awards.year} />
      <FoodCircles foods={foods} />
      <TrendRow drinks={top.list} note={top.note} compared={top.compared} />
      <PartnerRow items={home.partners.slice(0, 4)} />
      <BestPairings ds={c.dataset} />

      {picksMode === "feed" && (
        <section className="home-picks">
          <div className="section-head"><h2>회원이 추천한 페어링</h2><Link href="/picks">전체 보기</Link></div>
          <PickFeed posts={picks} compact />
        </section>
      )}
      {picksMode === "invite" && (
        <Link href="/picks#compose" className="picks-invite">
          <span className="pi-k">🙌 회원 추천{picks.length ? ` ${picks.length}건` : ""}</span>
          <span className="pi-t">나만 아는 “이 술엔 이 음식”을 남겨 주세요</span>
          <span className="pi-a">추천 남기기 →</span>
        </Link>
      )}

      <TriedPill />
    </div>
  );
}
