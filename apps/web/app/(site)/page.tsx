/** 랜딩 — 검색 유입이 도착했을 때 서비스가 뭔지 3초 안에 알리고 술·음식 목록으로 보낸다. */
import type { Metadata } from "next";
import Link from "next/link";
import ExtLink from "./_components/ExtLink";
import Heart from "./_components/Heart";
import HeroMarquee from "./_components/HeroMarquee";
import QuickMenu from "./_components/QuickMenu";
import { loadAwards } from "@/lib/awards";
import { listPosts } from "@/lib/member-picks";
import PickFeed from "./_components/PickFeed";
import { topDrinks } from "@/lib/popular";
import { FOOD_GROUPS, homePicksMode, buyLink, onlineSellable, POPULAR_FOODS, byDrink, byFood, toSlug, website } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import JsonLd from "./_components/JsonLd";

export const revalidate = 600;

export const metadata: Metadata = {
  // 링크 공유(카카오톡·문자) 미리보기 문구 — 2026-09-14 사용자 결정. openGraph를 함께 둬야 카카오가 이 문구를 쓴다
  title: "페어링GO — 맛있는 술과 어울리는 맛있는 음식은?",
  description: "전통주를 고르면 어울리는 음식을, 음식을 고르면 어울리는 전통주를 찾아 줍니다. 양조장·소믈리에·전문 매체의 근거를 함께 보여 줍니다.",
  alternates: { canonical: "/" },
  // images: 홈은 openGraph를 직접 적어 두어서 app/opengraph-image.tsx가 자동으로 붙지 않는다 — 명시(카톡 미리보기 그림)
  openGraph: { title: "페어링GO — 맛있는 술과 어울리는 맛있는 음식은?", description: "전통주를 고르면 어울리는 음식을, 음식을 고르면 어울리는 전통주를 찾아 줍니다.", url: "/", siteName: "페어링GO", type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "페어링GO" }] },
};

export default async function Home() {
  const c = await getCatalog();
  const top = topDrinks(c.dataset, 10);
  const awards = await loadAwards();
  const picks = await listPosts(4).catch(() => []);
  const picksMode = homePicksMode(picks.length);   // 글이 3건 미만이면 가운데 큰 칸 대신 아래쪽 작은 초대 카드(docs/20 P0-5)
  const drinks = (top.list.length ? top.list : c.dataset.drinks).slice(0, 8);
  const foods = (POPULAR_FOODS.length ? POPULAR_FOODS : c.dataset.foods).slice(0, 10);

  return (
    <div className="wrap">
      {/* 사이트 이름과 사이트 안 검색 — 구글 결과에 검색창이 붙을 수 있다(docs/20 P3-4) */}
      <JsonLd data={website({ base: siteUrl(), name: "페어링GO" })} />
      <section className="hero">
        <h1>전통주에 뭘 곁들일까</h1>
        <p>양조장과 소믈리에, 전문 매체, 대중이 추천한 데이터를 기반으로 전통주를 검색하면 어울리는 음식을, 음식을 검색하면 어울리는 전통주를 찾아 드립니다.</p>
        <ul className="stat">
          <li><b>{c.counts.drinks}</b><span>전통주</span></li>
          <li><b>{c.counts.foods}</b><span>음식·안주</span></li>
          <li><b>{c.counts.pairings.toLocaleString("ko-KR")}</b><span>페어링</span></li>
        </ul>
        <HeroMarquee drinks={top.list} note={top.note} compared={top.compared} />
        <Link href="/report" className="report-card">
          <span className="rp-k">{new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1}월 트렌드 리포트</span>
          <span className="rp-t">많이 찾는 전통주 순위 변동 · 핫한 페어링 · 회원 평가 · 지역별 검색을 한 장으로</span>
          <span className="rp-a">보기 →</span>
        </Link>
        <QuickMenu michelinYear={awards.year} />
        <div className="btns" style={{ marginTop: 18 }}>
          <Link className="btn p" href="/drinks">전통주 둘러보기</Link>
          <Link className="btn f" href="/foods">음식으로 찾기</Link>
        </div>
      </section>

      <section>
        <div className="section-head"><h2>많이 찾는 전통주</h2><Link href="/drinks">전체 보기</Link></div>
        <ul className="grid">
          {drinks.map((d) => (
            <li key={d.id}>
              <Link href={`/drinks/${toSlug(d.name)}`}>
                <span className="n">{d.name}</span>
                <span className="s">{[d.category, d.region, `어울리는 음식 ${(byDrink[d.id] || []).length}`].filter(Boolean).join(" · ")}</span>
              </Link>
              <span className="acts">{onlineSellable(d) ? <ExtLink href={buyLink(d).url} event="buy_link_click" props={{ d: d.id, store: buyLink(d).store, from: "home" }}>구매 ↗</ExtLink> : <Link href={`/drinks/${toSlug(d.name)}#places`}>판매점</Link>}</span>
              <Heart kind="drink" id={d.id} name={d.name} />
            </li>
          ))}
        </ul>
      </section>

      {picksMode === "feed" && (
        <section className="home-picks">
          <div className="section-head"><h2>회원이 추천한 페어링</h2><Link href="/picks">전체 보기</Link></div>
          <PickFeed posts={picks} compact />
        </section>
      )}

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
    </div>
  );
}
