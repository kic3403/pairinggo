/**
 * 음식 상세 (공개 웹) — "육회에 어울리는 술", "파전 막걸리" 같은 검색 유입을 받는 페이지.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { D, SRC_LABEL, byFood, explainOverall, findBySlug, scorePairings, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import RatingsProvider from "../../_components/RatingsProvider";
import MemberPickButton from "../../_components/MemberPickButton";
import PickTabs from "../../_components/PickTabs";
import { PairingCards, pickCounts, drinkHref, type CardItem } from "../../_components/PairingCards";
import Heart from "../../_components/Heart";
import NearbyPlaces from "../../_components/NearbyPlaces";
import DetailActionBar from "../../_components/DetailActionBar";
import ProfileBars from "../../_components/ProfileBars";
import ShareButton from "../../_components/ShareButton";

export const revalidate = 600;
/**
 * 빌드 때 카탈로그의 모든 음식 페이지와 공유 이미지(opengraph-image.tsx)를 미리 만든다(2026-09-15).
 * 없으면 상세·공유 이미지가 첫 요청 때 생성돼 3초 넘게 걸리고, 카카오 링크 미리보기 스크래퍼가 그림을 못 받았다(docs/20 P0-1).
 * 새로 넣은 음식(빌드 뒤 발행)은 첫 요청 때 만들어진다(dynamicParams 기본값).
 */
export async function generateStaticParams() {
  const c = await getCatalog();
  return c.dataset.foods.map((x) => ({ slug: toSlug(x.name) }));
}

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
    return { href: drinkHref(drink?.name || s.p.d), name: drink?.name || s.p.d, sub, grade: s.grade, explain: explainOverall(s, SRC_LABEL[s.p.src ?? "profile"]), pairing: s.p };
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
      <ProfileBars kind="food" profile={food.profile} />
      <div className="share-row"><ShareButton className="btn xs" title={`${food.name}에 어울리는 전통주 ${items.length}가지`} text={`${food.name}에 어울리는 전통주를 근거와 함께 — 페어링GO`} f={food.id} /></div>

      <div className="cols" style={{ marginTop: 8 }}>
        <div>
          {/* 맛집 찾기는 페어링 목록 위에 — 카드 수십 장 아래에 있으면 관심지역 버튼을 못 찾는다(2026-09-14 사용자 지적) */}
          {/* 저장 버튼은 맛집 칸의 버튼 줄에 같이 둔다(2026-09-14 사용자 요청 — 네이버 지도 버튼은 없앰) */}
          <NearbyPlaces mode="restaurants" food={food.name} foodId={food.id} actions={<Heart kind="food" id={food.id} name={food.name} variant="button" />} />
          <h2 id="pairings">{food.name}에 어울리는 전통주 {items.length}가지</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            어울림 등급(찰떡 · 잘 어울림 · 시도해 볼 만)은 전문가 평가(60%)·블로그 언급량(25%)·맛 프로필(15%)에 출처 등급을 더한 점수로 매깁니다. 같은 조합은 술 화면과 음식 화면에서 같은 등급입니다. 전문가픽은 양조장·소믈리에 추천, 대중픽은 블로그·유튜브 후기에서 확인된 조합이고, 먹어본 회원들의 평가가 함께 쌓입니다.
          </p>
          <MemberPickButton mode="food" subjectId={food.id} subjectName={food.name} options={c.dataset.drinks.map((d) => ({ id: d.id, name: d.name }))} />
          <RatingsProvider subject={{ food: food.id }}>
            <PickTabs counts={pickCounts(items)}>
              <PairingCards items={items} />
            </PickTabs>
          </RatingsProvider>
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
      <DetailActionBar save={<Heart kind="food" id={food.id} name={food.name} variant="button" />}>
        <a className="btn" href="#pairings">어울리는 전통주 {items.length}</a>
        <a className="btn f" href="#places">맛집 찾기</a>
      </DetailActionBar>
    </div>
  );
}
