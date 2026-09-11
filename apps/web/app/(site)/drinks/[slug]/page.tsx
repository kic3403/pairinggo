/**
 * 전통주 상세 (공개 웹) — "복순도가 안주", "막걸리 어울리는 음식" 같은 검색 유입을 받는 페이지.
 * 서버에서 렌더해 네이버·구글이 읽을 수 있게 한다. 데이터·점수 계산은 packages/shared 공유.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { F, byDrink, buyLink, findBySlug, onlineSellable, scorePairings, toSlug, fmt } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { PairingCards, foodHref, type CardItem } from "../../_components/PairingCards";
import Heart from "../../_components/Heart";

export const revalidate = 600;

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
  const description = `${drink.name}(${[drink.category, drink.abv != null ? `${drink.abv}%` : null, drink.brewery].filter(Boolean).join(" · ")})와 어울리는 음식을 양조장·소믈리에·전문 매체 근거와 함께 정리했습니다.`;
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
    return { href: foodHref(food?.name || s.p.f), name: food?.name || s.p.f, sub: food?.tags?.slice(0, 3).join(" · "), overall: s.overall, pairing: s.p };
  });

  const bl = buyLink(drink);
  const sellable = onlineSellable(drink);
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

      <div className="btns">
        {sellable
          ? <a className="btn p" href={bl.url} target="_blank" rel="noopener nofollow">{bl.store}에서 보기 ↗</a>
          : <span className="btn" aria-disabled>온라인 직배송 불가 (전통주 외 주류)</span>}
        <Heart kind="drink" id={drink.id} name={drink.name} variant="button" />
      </div>

      <div className="cols" style={{ marginTop: 8 }}>
        <div>
          <h2>{drink.name}과 어울리는 음식 {items.length}가지</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            종합 점수는 전문가 평가(60%)·대중 언급량(25%)·맛 프로필(15%)에 출처 등급을 더해 계산합니다.
          </p>
          <PairingCards items={items} />
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
    </div>
  );
}
