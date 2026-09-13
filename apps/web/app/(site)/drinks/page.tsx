/**
 * 전통주 목록 — 색인용 허브. 지역·양조장으로 거를 수 있고(검색 결과의 '둘러보기'가 여기로 온다), 카드마다 구매·하트.
 * 종류는 탭으로 나눠 한 번에 한 종류만 보여 준다(2026-09-13, 미쉐린·우리술품평회 연도 탭과 같은 방식, 사용자 결정).
 * 탭 = ?category=, 없으면 가장 많은 종류. 지역·양조장 조건은 탭을 옮겨도 유지.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { buyLink, byDrink, drinkInRegion, josa, onlineSellable, regionById, regionLabel, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import ExtLink from "../_components/ExtLink";
import Heart from "../_components/Heart";
import RegionTabs from "../_components/RegionTabs";

export const revalidate = 600;
type Q = { category?: string; region?: string; brewery?: string };

/** 종류 한 줄 설명 — 탭 아래에 보인다 */
const CATEGORY_NOTE: Record<string, string> = {
  탁주: "쌀·누룩으로 빚어 거르지 않은 막걸리. 탄산·단맛이 있어 전·튀김·매운 음식과 잘 맞습니다.",
  약주: "맑게 걸러 낸 술. 은은한 향과 산미로 한식 전반, 담백한 요리에 곁들이기 좋습니다.",
  청주: "맑게 거른 술로, 누룩보다 쌀 입국을 주로 써 맛이 깔끔합니다. 회·해산물과 무난하게 어울립니다.",
  증류주: "소주·고량주처럼 증류해 도수가 높은 술. 기름진 고기·진한 양념 요리와 잘 맞습니다.",
  과실주: "포도·사과·복분자 등 과일로 빚은 술. 치즈·디저트·가벼운 고기 요리와 어울립니다.",
  허니와인: "꿀을 발효한 벌꿀술(미드). 단맛과 꽃향이 있어 디저트·매운 음식과 맞습니다.",
  리큐르: "술에 과일·약재·꽃 등을 넣어 향을 입힌 술. 식후주나 디저트와 곁들입니다.",
  브랜디: "과실주를 증류해 숙성한 술. 식후에 조금씩, 초콜릿·견과류와 즐깁니다.",
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Q> }): Promise<Metadata> {
  const c = await getCatalog();
  const sp = await searchParams;
  const ro = regionById(sp.region);
  const f = [ro ? regionLabel(ro) : sp.region, sp.category, sp.brewery].filter(Boolean).join(" ") || undefined;
  const title = f ? `${f} 전통주 — 안주 추천 | 페어링GO` : `전통주 ${c.counts.drinks}종 — 막걸리·약주·증류주 안주 추천 | 페어링GO`;
  const description = `막걸리, 약주, 증류주, 과실주까지 전통주 ${c.counts.drinks}종과 어울리는 안주를 근거와 함께 정리했습니다.`;
  return { title, description, alternates: { canonical: "/drinks" }, openGraph: { title, description, url: "/drinks", siteName: "페어링GO" }, robots: f ? { index: false } : undefined };
}

export default async function DrinkIndex({ searchParams }: { searchParams: Promise<Q> }) {
  const c = await getCatalog();
  const sp = await searchParams;
  const filt = { category: sp.category?.trim(), region: sp.region?.trim(), brewery: sp.brewery?.trim() };
  // 지역은 두 가지 형태 — 지역 id(busan, cap…: 검색 옵션·칩)와 데이터 문자열(부산 금정: 검색 결과 '둘러보기')
  const regionObj = regionById(filt.region);
  const rLabel = regionObj ? regionLabel(regionObj) : filt.region;
  const active = [rLabel, filt.brewery].filter(Boolean).join(" ") || undefined;   // 예: "강원", "배상면주가" (종류는 탭)

  let list = c.dataset.drinks;
  let fallbackNote: string | null = null;
  if (regionObj) {
    let inRegion = list.filter((d) => drinkInRegion(d, regionObj));
    // 강남처럼 동 단위 지역에 등록된 양조장이 없으면 상위(서울) 기준으로 보여 주고 그 사실을 적는다
    if (!inRegion.length && regionObj.fb?.length) {
      inRegion = list.filter((d) => regionObj.fb!.some((p) => (d.region || "").startsWith(p)));
      if (inRegion.length) fallbackNote = `${regionLabel(regionObj)}에 등록된 양조장이 아직 없어 ${regionObj.fb[0]} 전체 기준으로 보여 드립니다.`;
    }
    list = inRegion;
  } else if (filt.region) list = list.filter((d) => (d.region || "").includes(filt.region!));
  if (filt.brewery) list = list.filter((d) => (d.brewery || "").includes(filt.brewery!));

  // 지역·양조장 조건을 건 뒤 종류별로 묶고, 많은 종류부터 탭으로
  const groups = new Map<string, typeof list>();
  for (const d of list) { const k = d.category || "기타"; groups.set(k, [...(groups.get(k) || []), d]); }
  const cats = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => ({ name: k, n: v.length }));
  const selected = cats.find((x) => x.name === filt.category)?.name ?? cats[0]?.name;
  const missingCat = filt.category && selected !== filt.category ? filt.category : null;   // 이 지역에 없는 종류를 골랐을 때
  const shown = selected ? groups.get(selected)! : [];
  const tabHref = (cat: string) => {
    const q = new URLSearchParams();
    if (filt.region) q.set("region", filt.region);
    if (filt.brewery) q.set("brewery", filt.brewery);
    q.set("category", cat);
    return `/drinks?${q.toString()}`;
  };

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link>{active && <> · <Link href="/drinks">전통주</Link></>}</p>
      <h1>{active ? `${active} 전통주 ${list.length}종` : `전통주 ${c.counts.drinks}종`}{selected && <span className="muted"> · {selected}</span>}</h1>
      <p className="lead">{active ? "조건을 지우려면 전통주 전체로 돌아가세요." : "종류별로 나눠 모았습니다. 술을 고르면 어울리는 안주와 그 근거, 구매처를 볼 수 있습니다."}</p>
      {!!cats.length && (
        <ul className="cat-tabs" aria-label="종류">
          {cats.map((x) => (
            <li key={x.name}><Link href={tabHref(x.name)} scroll={false} className={x.name === selected ? "on" : undefined} aria-current={x.name === selected ? "page" : undefined}>{x.name}<span className="cnt">{x.n}</span></Link></li>
          ))}
        </ul>
      )}
      <RegionTabs current={regionObj?.id} base="/drinks" keep={selected ? { category: selected } : {}} />
      {fallbackNote && <p className="small muted">{fallbackNote}</p>}
      {active && <div className="btns"><Link className="btn" href="/drinks">전체 보기</Link></div>}

      {!list.length && <p className="muted">해당하는 전통주가 없습니다.</p>}

      {missingCat && <p className="small muted">{rLabel ? `${rLabel}에는 ` : ""}등록된 {josa(missingCat, "이/가")} 없어 {josa(selected!, "을/를")} 보여 드립니다.</p>}

      {selected && (
        <section key={selected}>
          <h2>{selected} <span className="muted small">{shown.length}종</span></h2>
          {CATEGORY_NOTE[selected] && <p className="small muted" style={{ marginTop: -6 }}>{CATEGORY_NOTE[selected]}</p>}
          <ul className="grid">
            {shown.map((d) => {
              const bl = buyLink(d);
              return (
                <li key={d.id}>
                  <Link href={`/drinks/${toSlug(d.name)}`}>
                    <span className="n">{d.name}</span>
                    <span className="s">{[d.abv != null ? `${d.abv}%` : null, d.region, `페어링 ${(byDrink[d.id] || []).length}`].filter(Boolean).join(" · ")}</span>
                  </Link>
                  <span className="acts">
                    {onlineSellable(d)
                      ? <ExtLink href={bl.url} event="buy_link_click" props={{ d: d.id, store: bl.store, from: "drinks_list" }}>구매 ↗</ExtLink>
                      : <Link href={`/drinks/${toSlug(d.name)}#places`}>판매점</Link>}
                  </span>
                  <Heart kind="drink" id={d.id} name={d.name} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
