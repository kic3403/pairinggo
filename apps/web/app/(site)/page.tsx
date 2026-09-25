/**
 * 홈(2026-09-25 재구성, 캐치테이블·데일리샷 구조 참고 — docs/24) — 위에서부터
 *  ① 헤더(로고 + 전폭 검색창) ② 홈 탭(전통주·위스키·사케·와인·음식·수상·핫한 페어링) ③ 지역 줄 ④ 배너 캐러셀(리포트·이달의 파트너·이벤트)
 *  ⑤ 아이콘 10칸 ⑥ 서비스 타일 4장 ⑦ 파트너 매장 줄 ⑧ 많이 찾는 전통주(정지 카드) ⑨ 음식 종류 칩 ⑩ 회원 추천 ⑪ 안주로 찾기
 * 히어로 문장·숫자·흘러가는 마키·큰 버튼은 뺐다(사용자 결정). 검색 유입을 위한 한 줄 소개만 배너 위에.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Heart from "./_components/Heart";
import HomeTabs from "./_components/HomeTabs";
import HomeBanners from "./_components/HomeBanners";
import FlowTiles from "./_components/FlowTiles";
import PartnerRow from "./_components/PartnerRow";
import TrendRow from "./_components/TrendRow";
import TriedPill from "./_components/TriedPill";
import QuickMenu from "./_components/QuickMenu";
import PickFeed from "./_components/PickFeed";
import JsonLd from "./_components/JsonLd";
import { loadAwards } from "@/lib/awards";
import { homeCards } from "@/lib/banners";
import { listPosts } from "@/lib/member-picks";
import { topDrinks } from "@/lib/popular";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import { FOOD_GROUPS, POPULAR_FOODS, byFood, homePicksMode, toSlug, website } from "@pairinggo/shared";

export const revalidate = 600;

export const metadata: Metadata = {
  // 링크 공유(카카오톡·문자) 미리보기 문구 — 2026-09-14 사용자 결정. openGraph를 함께 둬야 카카오가 이 문구를 쓴다
  title: "페어링GO — 맛있는 술과 어울리는 맛있는 음식은?",
  description: "전통주·위스키·사케·와인을 고르면 어울리는 음식을, 음식을 고르면 어울리는 술을 찾아 줍니다. 양조장·소믈리에·전문 매체의 근거를 함께 보여 줍니다.",
  alternates: { canonical: "/" },
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
      <JsonLd data={website({ base: siteUrl(), name: "페어링GO" })} />
      <h1 className="home-h1">맛있는 술엔 맛있는 음식 <span className="muted">— 전통주·위스키·사케·와인과 어울리는 음식을 근거와 함께</span></h1>
      <HomeTabs />
      <HomeBanners cards={home.cards} />
      <QuickMenu michelinYear={awards.year} />
      <FlowTiles />
      <PartnerRow items={home.partners.slice(0, 8)} />
      <TrendRow drinks={top.list} note={top.note} compared={top.compared} />

      {/* 음식 종류별로 찾기 — 캐치테이블 홈의 "음식종류별 BEST" 칩 줄(docs/19 §5). 대분류는 shared food-groups.ts */}
      <section>
        <div className="section-head"><h2>음식 종류별로 찾기</h2><Link href="/foods">전체 보기</Link></div>
        <ul className="tabs group-chips" style={{ marginTop: 0 }}>
          {FOOD_GROUPS.map((g) => {
            const n = c.dataset.foods.filter((f) => g.categories.includes(f.category)).length;
            return n ? <li key={g.key}><Link href={`/foods?group=${encodeURIComponent(g.key)}`}>{g.key}<span className="cnt">{n}</span></Link></li> : null;
          })}
        </ul>
      </section>

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

      <section>
        <div className="section-head"><h2>안주로 찾기</h2><Link href="/foods">전체 보기</Link></div>
        <ul className="grid">
          {foods.map((f) => (
            <li key={f.id}>
              <Link href={`/foods/${toSlug(f.name)}`}>
                <span className="n">{f.name}</span>
                <span className="s">{[f.category, `어울리는 술 ${(byFood[f.id] || []).length}`].filter(Boolean).join(" · ")}</span>
              </Link>
              <Heart kind="food" id={f.id} name={f.name} />
            </li>
          ))}
        </ul>
      </section>
      <TriedPill />
    </div>
  );
}
