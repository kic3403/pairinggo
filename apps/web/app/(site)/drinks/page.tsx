/** 전통주 목록 — 색인용 허브. 종류·지역·양조장으로 거를 수 있고(검색 결과의 '둘러보기'가 여기로 온다), 카드마다 구매·하트. */
import type { Metadata } from "next";
import Link from "next/link";
import { buyLink, byDrink, onlineSellable, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import Heart from "../_components/Heart";

export const revalidate = 600;
type Q = { category?: string; region?: string; brewery?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Q> }): Promise<Metadata> {
  const c = await getCatalog();
  const sp = await searchParams;
  const f = sp.category || sp.region || sp.brewery;
  const title = f ? `${f} 전통주 — 안주 추천 | 페어링GO` : `전통주 ${c.counts.drinks}종 — 막걸리·약주·증류주 안주 추천 | 페어링GO`;
  const description = `막걸리, 약주, 증류주, 과실주까지 전통주 ${c.counts.drinks}종과 어울리는 안주를 근거와 함께 정리했습니다.`;
  return { title, description, alternates: { canonical: "/drinks" }, openGraph: { title, description, url: "/drinks", siteName: "페어링GO" }, robots: f ? { index: false } : undefined };
}

export default async function DrinkIndex({ searchParams }: { searchParams: Promise<Q> }) {
  const c = await getCatalog();
  const sp = await searchParams;
  const filt = { category: sp.category?.trim(), region: sp.region?.trim(), brewery: sp.brewery?.trim() };
  const active = filt.category || filt.region || filt.brewery;

  let list = c.dataset.drinks;
  if (filt.category) list = list.filter((d) => d.category === filt.category);
  if (filt.region) list = list.filter((d) => (d.region || "").includes(filt.region!));
  if (filt.brewery) list = list.filter((d) => (d.brewery || "").includes(filt.brewery!));

  const groups = new Map<string, typeof list>();
  for (const d of list) { const k = active ? "결과" : d.category || "기타"; groups.set(k, [...(groups.get(k) || []), d]); }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link>{active && <> · <Link href="/drinks">전통주</Link></>}</p>
      <h1>{active ? `${active} 전통주 ${list.length}종` : `전통주 ${c.counts.drinks}종`}</h1>
      <p className="lead">{active ? "조건을 지우려면 전통주 전체로 돌아가세요." : "종류별로 모았습니다. 술을 고르면 어울리는 안주와 그 근거, 구매처를 볼 수 있습니다."}</p>
      {active && <div className="btns"><Link className="btn" href="/drinks">전체 보기</Link></div>}

      {!list.length && <p className="muted">해당하는 전통주가 없습니다.</p>}

      {ordered.map(([cat, items]) => (
        <section key={cat}>
          {!active && <h2>{cat} <span className="muted small">{items.length}종</span></h2>}
          <ul className="grid">
            {items.map((d) => {
              const bl = buyLink(d);
              return (
                <li key={d.id}>
                  <Link href={`/drinks/${toSlug(d.name)}`}>
                    <span className="n">{d.name}</span>
                    <span className="s">{[d.abv != null ? `${d.abv}%` : null, d.region, `페어링 ${(byDrink[d.id] || []).length}`].filter(Boolean).join(" · ")}</span>
                  </Link>
                  <span className="acts">
                    {onlineSellable(d)
                      ? <a href={bl.url} target="_blank" rel="noopener nofollow">구매 ↗</a>
                      : <Link href={`/drinks/${toSlug(d.name)}#places`}>판매점</Link>}
                  </span>
                  <Heart kind="drink" id={d.id} name={d.name} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
