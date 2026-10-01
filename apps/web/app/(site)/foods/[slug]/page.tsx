/**
 * 음식 상세 (공개 웹) — "육회에 어울리는 술", "파전 막걸리" 같은 검색 유입을 받는 페이지.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { breadcrumb, byFood, findBySlug, foodEvidenceNeighbors, guideList, itemList, similarFoods, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { expertTiersByName } from "@/lib/experts";
import { siteUrl } from "@/lib/site";
import RatingsProvider from "../../_components/RatingsProvider";
import MemberPickButton from "../../_components/MemberPickButton";
import PickTabs from "../../_components/PickTabs";
import { PairingCards, pickCounts } from "../../_components/PairingCards";
import { capItems, foodItems } from "@/lib/detail-items";
import { recsForFood } from "@/lib/partner-recs";
import PartnerRecs from "../../_components/PartnerRecs";
import Heart from "../../_components/Heart";
import NearbyPlaces from "../../_components/NearbyPlaces";
import DetailActionBar from "../../_components/DetailActionBar";
import JsonLd from "../../_components/JsonLd";
import ProfileBars from "../../_components/ProfileBars";
import DetailMedia from "../../_components/DetailMedia";
import RecentTrack from "../../_components/RecentTrack";
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
  const title = `${food.name}에 어울리는 술 ${n}가지 | 페어링GO`;
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

  // 카드는 앞쪽 40장만 싣고 나머지는 /foods/[slug]/all — 171장을 다 실으면 1.1MB(2026-09-30, lib/detail-items.ts)
  const allItems = await foodItems(food);
  const { items } = capItems(allItems);
  const tiers = await expertTiersByName();

  const recs = await recsForFood({ id: food.id, name: food.name, category: food.category }).catch(() => []);
  // 근거 있는 페어링이 하나도 없으면 '준비 중'으로 알리고, 비슷한 음식의 확인된 술을 위로(2026-10-01, 술 상세와 같은 방식 — shared pairing/neighbors.ts)
  const hasEvidence = items.some((it) => ["official", "sommelier", "media", "blog", "user"].includes(it.pairing.src ?? ""));
  const drinkById = new Map(c.dataset.drinks.map((d) => [d.id, d]));
  const neighbors = hasEvidence ? [] : foodEvidenceNeighbors(similarFoods(food, 16).map((s) => ({ food: s.x, why: s.why.slice(0, 2) })), (id) => byFood[id], (id) => drinkById.get(id), 4, 2);
  const shown = new Set(neighbors.map((x) => x.food.id));
  const sameCategory = c.dataset.foods.filter((f) => f.id !== food.id && f.category === food.category && !shown.has(f.id)).slice(0, 8);

  const guide = guideList(c.dataset).find((g) => g.side === "food" && g.category === food.category);

  // 구조화 데이터 — 경로와 "이 음식에 어울리는 술" 목록(docs/20 P3-4)
  const base = siteUrl();
  const path = `/foods/${toSlug(food.name)}`;
  const ld = [
    breadcrumb([{ name: "홈", path: "/" }, { name: "음식·안주", path: "/foods" }, { name: food.name, path }], base),
    itemList(items.slice(0, 20).map((it) => ({ name: it.name, path: it.href })), { base, name: `${food.name}에 어울리는 술` }),
  ];

  return (
    <div className="wrap">
      <JsonLd data={ld} />
      <RecentTrack kind="food" id={food.id} name={food.name} meta={food.category} href={path} />
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/foods">음식·안주</Link></p>
      {/* 핵심 정보 한 카드(2026-09-25 정리) — 이름 · 분류 · 태그 · 공유, 맛 프로필은 옆에, 오른쪽 끝에 사진 칸(2026-09-26, 없으면 분류 타일) */}
      <header className="dhead">
        <div className="dhead-body">
          <h1>{food.name}</h1>
          <div className="meta"><span>{food.category}</span></div>
          {!!food.tags?.length && <ul className="tags">{food.tags.map((t) => <li key={t} className="tag">{t}</li>)}</ul>}
          <div className="dhead-acts"><ShareButton className="btn xs" title={`${food.name}에 어울리는 술 ${items.length}가지`} text={`${food.name}에 어울리는 술을 근거와 함께 — 페어링GO`} f={food.id} /></div>
        </div>
        <ProfileBars kind="food" profile={food.profile} />
        <DetailMedia kind="food" image={food.image} name={food.name} label={food.category} />
      </header>

      <div className="cols" style={{ marginTop: 8 }}>
        <div>
          {/* 맛집 찾기는 페어링 목록 위에 — 카드 수십 장 아래에 있으면 관심지역 버튼을 못 찾는다(2026-09-14 사용자 지적) */}
          {/* 저장 버튼은 맛집 칸의 버튼 줄에 같이 둔다(2026-09-14 사용자 요청 — 네이버 지도 버튼은 없앰) */}
          <NearbyPlaces mode="restaurants" food={food.name} foodId={food.id} drinkOptions={items.map((it) => ({ id: it.pairing.d, name: it.name }))} actions={<Heart kind="food" id={food.id} name={food.name} variant="button" />} />
          <h2 id="pairings">{food.name}에 어울리는 술 {items.length}가지</h2>
          <details className="fold small">
            <summary>어울림 등급은 어떻게 매기나요</summary>
            <p className="small muted">어울림 등급은 <b>근거가 먼저</b>입니다. 양조장·소믈리에 추천이 있거나 서로 다른 출처가 여럿 확인한 조합만 ‘근거 확인’이 되고, 그중 어울림 점수(근거 강도 60% · 맛 분석 25% · 블로그 언급 15%)가 높은 조합이 <b>찰떡</b>, 나머지가 <b>잘 어울림</b>입니다. 블로그·매체 한 곳뿐인 조합은 ‘근거 약함’, 근거 글 없이 맛 프로필로 계산한 조합은 ‘추정’이라 늘 <b>시도해 볼 만</b>으로 둡니다. 같은 매체·같은 블로그·같은 사람은 한 곳으로 세고, 같은 조합은 술 화면과 음식 화면에서 같은 등급입니다.</p>
          </details>
          {!hasEvidence && <p className="box small" style={{ marginBottom: 12 }}><b>페어링 정보 준비 중</b> — 아직 양조장·소믈리에·매체가 확인한 조합이 없습니다. 아래 카드는 맛 프로필로 추정한 조합이며 검증된 추천이 아닙니다.</p>}
          {neighbors.length > 0 && (
            <section className="box neighbors f" aria-labelledby="neighbors-h">
              <h3 id="neighbors-h">근거가 확인된 비슷한 음식</h3>
              <p className="small muted">비슷한 음식은 이런 술과 확인됐어요. {food.name}에도 참고해 보세요.</p>
              <ul>
                {neighbors.map((x) => (
                  <li key={x.food.id}>
                    <div className="nb-top">
                      <Link href={`/foods/${toSlug(x.food.name)}`}><b>{x.food.name}</b></Link>
                      <span className="small muted">{x.why.join(" · ")}</span>
                    </div>
                    <div className="nb-foods">
                      {x.drinks.map((d) => <Link key={d.drink.id} className="nb-chip" href={`/drinks/${toSlug(d.drink.name)}`}>{d.drink.name}<span className="small muted"> · {d.conf === "confirmed" ? "근거 확인" : "근거 약함"}</span></Link>)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <MemberPickButton mode="food" subjectId={food.id} subjectName={food.name} options={c.dataset.drinks.map((d) => ({ id: d.id, name: d.name }))} />
          <RatingsProvider subject={{ food: food.id }}>
            <PickTabs counts={pickCounts(allItems)} loaded={items.length} moreHref={`/foods/${toSlug(food.name)}/all`}>
              <PairingCards items={items} tiers={tiers} />
            </PickTabs>
          </RatingsProvider>
          <PartnerRecs recs={recs} title="양조장·식당이 추천한 조합" note={`${food.name}과 같거나 비슷한 음식으로 파트너가 직접 추천한 조합이에요.`} />
        </div>

        <aside>
          {guide && <p className="guide-go"><Link href={`/guide/${guide.slug}`}>{guide.h1} 모음 →</Link></p>}
          {!!sameCategory.length && (
            <div className="box">
              <h3>{food.category} 다른 메뉴</h3>
              <ul>{sameCategory.map((f) => <li key={f.id}><Link href={`/foods/${toSlug(f.name)}`}>{f.name}</Link></li>)}</ul>
            </div>
          )}
        </aside>
      </div>
      <DetailActionBar save={<Heart kind="food" id={food.id} name={food.name} variant="button" />}>
        <a className="btn" href="#pairings">어울리는 술 {items.length}</a>
        <a className="btn f" href="#places">맛집 찾기</a>
      </DetailActionBar>
    </div>
  );
}
