/** 랜딩 — 검색 유입이 도착했을 때 서비스가 뭔지 3초 안에 알리고 술·음식 목록으로 보낸다. */
import type { Metadata } from "next";
import Link from "next/link";
import ExtLink from "./_components/ExtLink";
import Heart from "./_components/Heart";
import HeroMarquee from "./_components/HeroMarquee";
import { topDrinks } from "@/lib/popular";
import { buyLink, onlineSellable, POPULAR_FOODS, byDrink, byFood, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "페어링GO — 전통주와 어울리는 안주, 근거와 함께",
  description: "전통주를 고르면 어울리는 음식을, 음식을 고르면 어울리는 전통주를 찾아 줍니다. 양조장·소믈리에·전문 매체의 근거를 함께 보여 줍니다.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const c = await getCatalog();
  const top = topDrinks(c.dataset, 10);
  const drinks = (top.list.length ? top.list : c.dataset.drinks).slice(0, 8);
  const foods = (POPULAR_FOODS.length ? POPULAR_FOODS : c.dataset.foods).slice(0, 10);

  return (
    <div className="wrap">
      <section className="hero">
        <h1>전통주에 뭘 곁들일까</h1>
        <p>술을 고르면 어울리는 안주를, 안주를 고르면 어울리는 술을 찾아 드립니다. 양조장과 소믈리에, 전문 매체가 실제로 한 말을 근거로 함께 보여 줍니다.</p>
        <ul className="stat">
          <li><b>{c.counts.drinks}</b><span>전통주</span></li>
          <li><b>{c.counts.foods}</b><span>음식·안주</span></li>
          <li><b>{c.counts.pairings.toLocaleString("ko-KR")}</b><span>페어링</span></li>
        </ul>
        <HeroMarquee drinks={top.list} note={top.note} />
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
