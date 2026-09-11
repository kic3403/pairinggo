/** 음식 목록 — 색인용 허브 페이지. 분류별로 묶어 내부 링크를 만든다. */
import type { Metadata } from "next";
import Link from "next/link";
import { byFood, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getCatalog();
  const title = `음식·안주 ${c.counts.foods}종 — 어울리는 전통주 추천 | 페어링GO`;
  const description = `육회, 파전, 삼겹살, 회까지 음식 ${c.counts.foods}종에 어울리는 막걸리·약주·증류주를 근거와 함께 정리했습니다.`;
  return { title, description, alternates: { canonical: "/foods" }, openGraph: { title, description, url: "/foods", siteName: "페어링GO" } };
}

export default async function FoodIndex() {
  const c = await getCatalog();
  const groups = new Map<string, typeof c.dataset.foods>();
  for (const f of c.dataset.foods) {
    const k = f.category || "기타";
    groups.set(k, [...(groups.get(k) || []), f]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>음식·안주 {c.counts.foods}종</h1>
      <p className="lead">분류별로 모았습니다. 음식을 고르면 어울리는 전통주와 그 근거를 볼 수 있습니다.</p>

      {ordered.map(([cat, list]) => (
        <section key={cat}>
          <h2>{cat} <span className="muted small">{list.length}종</span></h2>
          <ul className="grid">
            {list.map((f) => (
              <li key={f.id}>
                <Link href={`/foods/${toSlug(f.name)}`}>
                  <span className="n">{f.name}</span>
                  <span className="s">{[f.tags?.slice(0, 2).join(" · "), `페어링 ${(byFood[f.id] || []).length}`].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
