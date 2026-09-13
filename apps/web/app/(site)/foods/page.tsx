/**
 * 음식 목록 — 색인용 허브 페이지. 분류는 탭으로 나눠 한 번에 한 분류만 보여 준다(2026-09-13, 전통주 목록과 같은 방식, 사용자 결정).
 * 탭 = ?category=, 없으면 가장 많은 분류(한식).
 */
import type { Metadata } from "next";
import Link from "next/link";
import Heart from "../_components/Heart";
import { byFood, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 600;
type Q = { category?: string };

/** 분류 한 줄 설명 — 탭 아래에 보인다 */
const CATEGORY_NOTE: Record<string, string> = {
  한식: "찌개·볶음·찜 같은 밥상 요리. 양념이 진할수록 단맛 있는 탁주·약주가, 담백할수록 맑은 술이 맞습니다.",
  해산물: "굴·조개·새우·게 요리. 산미 있는 술과 가벼운 약주, 도수 낮은 증류주가 비린 맛을 눌러 줍니다.",
  안주: "두부김치·골뱅이·계란말이처럼 술자리 안주. 막걸리와 폭넓게 어울립니다.",
  구이: "고기·생선 구이. 기름기와 불향에는 도수 있는 증류주나 바디 있는 탁주가 맞습니다.",
  회: "생선회. 향이 절제된 약주·청주, 깔끔한 증류주가 재료 맛을 살립니다.",
  양식: "파스타·스테이크·치즈. 과실주와 허니와인, 오크 숙성 증류주가 잘 맞습니다.",
  전: "파전·빈대떡·전류. 막걸리의 대표 짝으로, 탄산과 산미가 기름기를 씻어 줍니다.",
  디저트: "케이크·약과·초콜릿. 단맛 있는 약주·허니와인·리큐르와 곁들입니다.",
  마른안주: "육포·먹태·견과. 증류주와 오크 숙성 술에 잘 맞습니다.",
  분식: "떡볶이·순대. 달콤한 막걸리와 탄산 있는 술이 매운맛을 감싸 줍니다.",
  면: "냉면·막국수·칼국수. 가볍고 산뜻한 탁주·약주가 맞습니다.",
  치킨: "후라이드·양념치킨. 스파클링 막걸리가 '치막'으로 잘 맞습니다.",
  튀김: "새우튀김·감자튀김. 탄산과 산미로 기름기를 정리하는 술이 맞습니다.",
  중식: "짜장면·양꼬치. 고량주 계열 증류주와 도수 있는 술이 어울립니다.",
  일식: "초밥. 맑은 청주·약주가 잘 맞습니다.",
  무침: "새콤한 무침. 산미 있는 술과 가벼운 탁주가 맞습니다.",
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Q> }): Promise<Metadata> {
  const c = await getCatalog();
  const sp = await searchParams;
  const cat = sp.category?.trim();
  const title = cat ? `${cat} 음식에 어울리는 전통주 | 페어링GO` : `음식·안주 ${c.counts.foods}종 — 어울리는 전통주 추천 | 페어링GO`;
  const description = `육회, 파전, 삼겹살, 회까지 음식 ${c.counts.foods}종에 어울리는 막걸리·약주·증류주를 근거와 함께 정리했습니다.`;
  return { title, description, alternates: { canonical: "/foods" }, openGraph: { title, description, url: "/foods", siteName: "페어링GO" }, robots: cat ? { index: false } : undefined };
}

export default async function FoodIndex({ searchParams }: { searchParams: Promise<Q> }) {
  const c = await getCatalog();
  const sp = await searchParams;
  const groups = new Map<string, typeof c.dataset.foods>();
  for (const f of c.dataset.foods) {
    const k = f.category || "기타";
    groups.set(k, [...(groups.get(k) || []), f]);
  }
  const cats = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => ({ name: k, n: v.length }));
  const selected = cats.find((x) => x.name === sp.category?.trim())?.name ?? cats[0]?.name;
  const shown = selected ? groups.get(selected)! : [];

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>음식·안주 {c.counts.foods}종{selected && <span className="muted"> · {selected}</span>}</h1>
      <p className="lead">분류별로 나눠 모았습니다. 음식을 고르면 어울리는 전통주와 그 근거를 볼 수 있습니다.</p>
      {!!cats.length && (
        <ul className="cat-tabs" aria-label="분류">
          {cats.map((x) => (
            <li key={x.name}><Link href={`/foods?category=${encodeURIComponent(x.name)}`} scroll={false} className={x.name === selected ? "on" : undefined} aria-current={x.name === selected ? "page" : undefined}>{x.name}<span className="cnt">{x.n}</span></Link></li>
          ))}
        </ul>
      )}

      {selected && (
        <section key={selected}>
          <h2>{selected} <span className="muted small">{shown.length}종</span></h2>
          {CATEGORY_NOTE[selected] && <p className="small muted" style={{ marginTop: -6 }}>{CATEGORY_NOTE[selected]}</p>}
          <ul className="grid">
            {shown.map((f) => (
              <li key={f.id}>
                <Link href={`/foods/${toSlug(f.name)}`}>
                  <span className="n">{f.name}</span>
                  <span className="s">{[f.tags?.slice(0, 2).join(" · "), `페어링 ${(byFood[f.id] || []).length}`].filter(Boolean).join(" · ")}</span>
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
