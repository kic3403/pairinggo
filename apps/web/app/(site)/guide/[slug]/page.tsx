/**
 * 모음 화면(2026-10-01) — "막걸리 안주 추천"·"전과 어울리는 술"처럼 종류로 찾는 검색어를 받는다.
 * 술·음식 상세가 이름 검색을, 여기가 종류 검색을 받는다. 근거(확인·약함)가 있는 조합만 모은다(shared seo/guides.ts).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { breadcrumb, findGuide, guideContent, guideList, itemList, josa, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import JsonLd from "../../_components/JsonLd";

export const revalidate = 3600;

export async function generateStaticParams() {
  const c = await getCatalog();
  return guideList(c.dataset).map((g) => ({ slug: g.slug }));
}

async function load(slug: string) {
  const c = await getCatalog();
  return { c, def: findGuide(c.dataset, slug) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { def } = await load((await params).slug);
  if (!def) return { title: "페어링GO" };
  const url = `/guide/${def.slug}`;
  return { title: `${def.title} | 페어링GO`, description: def.description, alternates: { canonical: url }, openGraph: { title: def.title, description: def.description, url, type: "article", siteName: "페어링GO", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "페어링GO" }] } };
}

const confLabel = (c: "confirmed" | "weak") => (c === "confirmed" ? "근거 확인" : "근거 약함");

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { c, def } = await load((await params).slug);
  if (!def) notFound();
  const g = guideContent(c.dataset, def);
  const others = guideList(c.dataset).filter((x) => x.slug !== def.slug);
  const isDrink = def.side === "drink";
  const rows = isDrink ? g.foods : g.drinks;
  const base = siteUrl();
  const path = `/guide/${def.slug}`;
  const ld = [
    breadcrumb([{ name: "홈", path: "/" }, { name: "페어링 모음", path: "/guide" }, { name: def.h1, path }], base),
    itemList(rows.map((r) => ({ name: r.item.name, path: `/${isDrink ? "foods" : "drinks"}/${toSlug(r.item.name)}` })), { base, name: def.h1 }),
  ];
  // 목록으로 가는 길 — 음식 종류 모음만 그 종류 목록으로, 지역·맛 모음은 전체 목록으로(그 기준의 목록 화면이 따로 없다)
  const listHref = isDrink ? "/drinks?kind=trad" : def.by === "category" ? `/foods?category=${encodeURIComponent(def.category)}` : "/foods";

  return (
    <div className="wrap guide">
      <JsonLd data={ld} />
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/guide">페어링 모음</Link></p>
      <h1>{def.h1}</h1>
      <p className="lead">
        {isDrink
          ? <>양조장·소믈리에·매체·후기가 확인한 조합 <b>{def.n}개</b>에서 뽑은, {josa(def.word, "과/와")} 자주 짝지어진 음식 순서입니다. 추정 조합은 넣지 않았어요.</>
          : <>양조장·소믈리에·매체·후기가 확인한 조합 <b>{def.n}개</b>에서 뽑은, {josa(def.word, "과/와")} 자주 짝지어진 전통주 순서입니다. 추정 조합은 넣지 않았어요.</>}
      </p>

      {g.mix.length > 1 && (
        <p className="guide-mix small">
          <b>{isDrink ? "어떤 음식과 많이 어울리나" : "어떤 술이 많이 어울리나"}</b>
          {g.mix.slice(0, 6).map((m) => <span key={m.name} className="tag">{m.name} {m.n}</span>)}
        </p>
      )}

      <ol className="guide-list">
        {rows.map((r, i) => (
          <li key={r.item.id}>
            <span className="rank" aria-hidden>{i + 1}</span>
            <div className="grow">
              <Link className={`g-name ${isDrink ? "f" : "d"}`} href={`/${isDrink ? "foods" : "drinks"}/${toSlug(r.item.name)}`}><b>{r.item.name}</b></Link>
              <span className="small muted"> · 근거 조합 {r.n}개{r.confirmed > 0 ? ` (확인 ${r.confirmed})` : ""}</span>
              <div className="nb-foods">
                {r.with.map((w) => (
                  <Link key={w.item.id} className={`nb-chip ${isDrink ? "d" : "f"}`}
                    href={isDrink ? `/drinks/${toSlug(w.item.name)}` : `/foods/${toSlug(w.item.name)}?d=${r.item.id}`}>
                    {w.item.name}<span className="small muted"> · {confLabel(w.conf)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="btns" style={{ marginTop: 16 }}>
        <Link className="btn p" href={listHref}>{isDrink ? "전통주 전체 보기" : def.by === "category" ? `${def.category} 메뉴 전체 보기` : "음식 전체 보기"}</Link>
        <Link className="btn" href="/today">오늘의 페어링</Link>
      </div>

      {others.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2>다른 모음</h2>
          <ul className="guide-links">
            {others.map((x) => <li key={x.slug}><Link href={`/guide/${x.slug}`}>{x.h1}</Link></li>)}
          </ul>
        </section>
      )}
      <p className="small muted" style={{ marginTop: 18 }}>순서는 근거가 확인된 조합에 2점, 근거가 약한 조합에 1점을 주어 더한 값입니다. 조합마다의 근거와 출처는 술·음식 화면에서 볼 수 있어요.</p>
    </div>
  );
}
