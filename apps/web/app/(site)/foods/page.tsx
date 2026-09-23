/**
 * 음식 목록 — 색인용 허브 페이지. 대분류(한식·양식·중식·일식·안주·간식·디저트, shared food-groups.ts) 탭 → 그 아래 소분류 칩 → 가나다순 목록
 * (2026-09-14 사용자 결정. 소분류가 하나뿐인 대분류는 칩을 숨긴다). ?group= 대분류, ?category= 소분류(없으면 전체).
 */
import type { Metadata } from "next";
import Link from "next/link";
import Heart from "../_components/Heart";
import { FOOD_GROUPS, FOOD_GROUP_OTHER, breadcrumb, byFood, byKoName, foodGroupOf, itemList, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import JsonLd from "../_components/JsonLd";

export const revalidate = 600;
type Q = { group?: string; category?: string };

/** 분류 한 줄 설명 — 탭 아래에 보인다 */
const CATEGORY_NOTE: Record<string, string> = {
  한식: "찌개·볶음·찜 같은 밥상 요리. 양념이 진할수록 단맛 있는 탁주·약주가, 담백할수록 맑은 술이 맞습니다.",
  해산물: "굴·조개·새우·게 요리. 산미 있는 술과 가벼운 약주, 도수 낮은 증류주가 비린 맛을 눌러 줍니다.",
  안주: "두부김치·골뱅이·계란말이처럼 술자리 안주. 막걸리와 폭넓게 어울립니다.",
  구이: "고기·생선 구이. 기름기와 불향에는 도수 있는 증류주나 바디 있는 탁주가 맞습니다.",
  회: "생선회. 향이 절제된 약주·청주, 깔끔한 증류주가 재료 맛을 살립니다.",
  양식: "파스타·스테이크·버거·샤퀴테리. 과실주와 허니와인, 오크 숙성 증류주가 잘 맞습니다.",
  전: "파전·빈대떡·전류. 막걸리의 대표 짝으로, 탄산과 산미가 기름기를 씻어 줍니다.",
  디저트: "케이크·약과·초콜릿. 단맛 있는 약주·허니와인·리큐르와 곁들입니다.",
  마른안주: "육포·먹태·견과. 증류주와 오크 숙성 술에 잘 맞습니다.",
  분식: "떡볶이·순대. 달콤한 막걸리와 탄산 있는 술이 매운맛을 감싸 줍니다.",
  면: "냉면·막국수·칼국수. 가볍고 산뜻한 탁주·약주가 맞습니다.",
  치킨: "후라이드·양념치킨. 스파클링 막걸리가 '치막'으로 잘 맞습니다.",
  튀김: "새우튀김·감자튀김. 탄산과 산미로 기름기를 정리하는 술이 맞습니다.",
  중식: "짬뽕·탕수육·마라탕·딤섬. 기름지고 향이 센 요리에는 증류주, 새콤달콤한 소스에는 과실주·리큐르가 어울립니다.",
  일식: "초밥·라멘·돈카츠·스키야키. 담백한 요리에는 맑은 청주·약주, 튀김·진한 국물에는 증류주가 맞습니다.",
  아시아: "쌀국수·팟타이·똠얌꿍·카레. 새콤하고 매운 향신료 요리에는 산미 있는 탁주·과실주가 잘 맞습니다.",
  무침: "새콤한 무침. 산미 있는 술과 가벼운 탁주가 맞습니다.",
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Q> }): Promise<Metadata> {
  const c = await getCatalog();
  const sp = await searchParams;
  const cat = sp.category?.trim() || sp.group?.trim();
  const title = cat ? `${cat} 음식에 어울리는 전통주 | 페어링GO` : `음식·안주 ${c.counts.foods}종 — 어울리는 전통주 추천 | 페어링GO`;
  const description = `육회, 파전, 삼겹살, 회까지 음식 ${c.counts.foods}종에 어울리는 막걸리·약주·증류주를 근거와 함께 정리했습니다.`;
  return { title, description, alternates: { canonical: "/foods" }, openGraph: { title, description, url: "/foods", siteName: "페어링GO" }, robots: cat ? { index: false } : undefined };
}

export default async function FoodIndex({ searchParams }: { searchParams: Promise<Q> }) {
  const c = await getCatalog();
  const sp = await searchParams;
  // 대분류 → 소분류 → 음식. 대분류 순서는 FOOD_GROUPS, 소분류 순서는 그 표의 순서, 음식은 가나다순
  const byGroup = new Map<string, Map<string, typeof c.dataset.foods>>();
  for (const f of c.dataset.foods) {
    const g = foodGroupOf(f.category), k = f.category || FOOD_GROUP_OTHER;
    const sub = byGroup.get(g) ?? new Map(); byGroup.set(g, sub);
    sub.set(k, [...(sub.get(k) || []), f]);
  }
  const groupOrder = [...FOOD_GROUPS.map((g) => g.key), FOOD_GROUP_OTHER].filter((g) => byGroup.has(g));
  const groups = groupOrder.map((g) => ({ name: g, n: [...byGroup.get(g)!.values()].reduce((a, v) => a + v.length, 0) }));
  const wantGroup = sp.group?.trim(), wantCat = sp.category?.trim();
  // ?category=만 왔으면(옛 링크) 그 소분류가 속한 대분류로
  const group = groups.find((g) => g.name === wantGroup)?.name ?? (wantCat && byGroup.has(foodGroupOf(wantCat)) ? foodGroupOf(wantCat) : groups[0]?.name);
  const subMap = group ? byGroup.get(group)! : new Map<string, typeof c.dataset.foods>();
  const subOrder = [...(FOOD_GROUPS.find((g) => g.key === group)?.categories ?? []), ...subMap.keys()].filter((k, i, a) => subMap.has(k) && a.indexOf(k) === i);
  const subs = subOrder.map((k) => ({ name: k, n: subMap.get(k)!.length }));
  const selectedSub = subs.find((x) => x.name === wantCat)?.name ?? null;   // null = 대분류 전체
  const shown = (selectedSub ? subMap.get(selectedSub)! : [...subMap.values()].flat()).slice().sort(byKoName);
  const groupHref = (g: string) => `/foods?group=${encodeURIComponent(g)}`;
  const subHref = (k: string | null) => (k ? `/foods?group=${encodeURIComponent(group!)}&category=${encodeURIComponent(k)}` : groupHref(group!));

  const base = siteUrl();
  const ld = [
    breadcrumb([{ name: "홈", path: "/" }, { name: "음식·안주", path: "/foods" }], base),
    itemList(shown.slice(0, 30).map((f) => ({ name: f.name, path: `/foods/${toSlug(f.name)}` })), { base, name: "음식·안주" }),
  ];

  return (
    <div className="wrap">
      <JsonLd data={ld} />
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>음식·안주 {c.counts.foods}종{group && <span className="muted"> · {group}{selectedSub ? ` · ${selectedSub}` : ""}</span>}</h1>
      <p className="lead">한식·양식·중식·일식 같은 큰 분류를 고르고, 그 안에서 세부 분류로 좁혀 보세요. 음식을 고르면 어울리는 전통주와 그 근거를 볼 수 있습니다.</p>
      {!!groups.length && (
        <ul className="cat-tabs" aria-label="대분류">
          {groups.map((x) => (
            <li key={x.name}><Link href={groupHref(x.name)} scroll={false} className={x.name === group ? "on" : undefined} aria-current={x.name === group ? "page" : undefined}>{x.name}<span className="cnt">{x.n}</span></Link></li>
          ))}
        </ul>
      )}
      {group && subs.length > 1 && (
        <ul className="tabs sub-tabs" aria-label="세부 분류" style={{ marginTop: 0 }}>
          <li><Link href={subHref(null)} scroll={false} className={!selectedSub ? "on" : undefined}>전체<span className="cnt">{shown.length && !selectedSub ? shown.length : [...subMap.values()].flat().length}</span></Link></li>
          {subs.map((x) => <li key={x.name}><Link href={subHref(x.name)} scroll={false} className={x.name === selectedSub ? "on" : undefined}>{x.name}<span className="cnt">{x.n}</span></Link></li>)}
        </ul>
      )}

      {group && (
        <section key={`${group}/${selectedSub ?? ""}`}>
          <h2>{selectedSub ?? group} <span className="muted small">{shown.length}종 · 가나다순</span></h2>
          {CATEGORY_NOTE[selectedSub ?? group] && <p className="small muted" style={{ marginTop: -6 }}>{CATEGORY_NOTE[selectedSub ?? group]}</p>}
          <ul className="grid">
            {shown.map((f) => (
              <li key={f.id}>
                <Link href={`/foods/${toSlug(f.name)}`}>
                  <span className="n">{f.name}</span>
                  <span className="s">{[selectedSub ? null : f.category, f.tags?.slice(0, 2).join(" · "), `페어링 ${(byFood[f.id] || []).length}`].filter(Boolean).join(" · ")}</span>
                </Link>
                <Heart kind="food" id={f.id} name={f.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
