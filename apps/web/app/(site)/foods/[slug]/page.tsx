/**
 * 음식 상세 (공개 웹) — "육회에 어울리는 술", "파전 막걸리" 같은 검색 유입을 받는 페이지.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { D, byFood, findBySlug, naverMapUrl, scorePairings, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { PairingCards, drinkHref, type CardItem } from "../../_components/PairingCards";
import Heart from "../../_components/Heart";
import NearbyPlaces from "../../_components/NearbyPlaces";

export const revalidate = 600;

async function load(slug: string) {
  const c = await getCatalog();
  const food = findBySlug(c.dataset.foods, slug, (f) => f.name);
  return { c, food };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { food } = await load((await params).slug);
  if (!food) return { title: "찾을 수 없는 음식 | 페어링GO" };
  const n = (byFood[food.id] || []).length;
  const title = `${food.name}에 어울리는 전통주 ${n}가지 | 페어링GO`;
  const description = `${food.name}과 잘 맞는 막걸리·약주·증류주를 양조장·소믈리에·전문 매체 근거와 함께 정리했습니다.`;
  const url = `/foods/${toSlug(food.name)}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article", siteName: "페어링GO" },
  };
}

export default async function FoodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { c, food } = await load((await params).slug);
  if (!food) notFound();

  const rows = byFood[food.id] || [];
  const scored = scorePairings(rows, (p) => D[p.d]?.category || "");
  const items: CardItem[] = scored.map((s) => {
    const drink = D[s.p.d];
    const sub = [drink?.category, drink?.abv != null ? `${drink.abv}%` : null, drink?.region].filter(Boolean).join(" · ");
    return { href: drinkHref(drink?.name || s.p.d), name: drink?.name || s.p.d, sub, overall: s.overall, pairing: s.p };
  });

  const sameCategory = c.dataset.foods.filter((f) => f.id !== food.id && f.category === food.category).slice(0, 8);

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/foods">음식·안주</Link></p>
      <h1>{food.name}</h1>
      <div className="meta">
        <span>{food.category}</span>
        {!!food.tags?.length && <><span className="muted"> · </span><span>{food.tags.join(" · ")}</span></>}
      </div>

      <div className="btns">
        <a className="btn f" href={naverMapUrl(`${food.name} 맛집`)} target="_blank" rel="noopener nofollow">{food.name} 맛집 찾기 ↗</a>
        <Heart kind="food" id={food.id} name={food.name} variant="button" />
      </div>

      <div className="cols" style={{ marginTop: 8 }}>
        <div>
          <h2>{food.name}에 어울리는 전통주 {items.length}가지</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            종합 점수는 전문가 평가(60%)·대중 언급량(25%)·맛 프로필(15%)에 출처 등급을 더해 계산합니다.
          </p>
          <PairingCards items={items} />
          <NearbyPlaces mode="restaurants" food={food.name} />
        </div>

        <aside>
          {!!sameCategory.length && (
            <div className="box">
              <h3>{food.category} 다른 메뉴</h3>
              <ul>{sameCategory.map((f) => <li key={f.id}><Link href={`/foods/${toSlug(f.name)}`}>{f.name}</Link></li>)}</ul>
            </div>
          )}
          <div className="box">
            <h3>데이터</h3>
            <ul>
              <li>등록된 페어링 {items.length}건</li>
              <li>전체 음식 {c.counts.foods}종</li>
              <li>전체 전통주 {c.counts.drinks}종</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
