/** 전통주 목록 — 색인용 허브 페이지. 종류·지역별로 묶어 내부 링크를 만든다. */
import type { Metadata } from "next";
import Link from "next/link";
import Heart from "../_components/Heart";
import { byDrink, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getCatalog();
  const title = `전통주 ${c.counts.drinks}종 — 막걸리·약주·증류주 안주 추천 | 페어링GO`;
  const description = `막걸리, 약주, 증류주, 과실주까지 전통주 ${c.counts.drinks}종과 어울리는 안주를 근거와 함께 정리했습니다.`;
  return { title, description, alternates: { canonical: "/drinks" }, openGraph: { title, description, url: "/drinks", siteName: "페어링GO" } };
}

export default async function DrinkIndex() {
  const c = await getCatalog();
  const groups = new Map<string, typeof c.dataset.drinks>();
  for (const d of c.dataset.drinks) {
    const k = d.category || "기타";
    groups.set(k, [...(groups.get(k) || []), d]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>전통주 {c.counts.drinks}종</h1>
      <p className="lead">종류별로 모았습니다. 술을 고르면 어울리는 안주와 그 근거를 볼 수 있습니다.</p>

      {ordered.map(([cat, list]) => (
        <section key={cat}>
          <h2>{cat} <span className="muted small">{list.length}종</span></h2>
          <ul className="grid">
            {list.map((d) => (
              <li key={d.id}>
                <Link href={`/drinks/${toSlug(d.name)}`}>
                  <span className="n">{d.name}</span>
                  <span className="s">{[d.abv != null ? `${d.abv}%` : null, d.region, `페어링 ${(byDrink[d.id] || []).length}`].filter(Boolean).join(" · ")}</span>
                </Link>
                <Heart kind="drink" id={d.id} name={d.name} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
