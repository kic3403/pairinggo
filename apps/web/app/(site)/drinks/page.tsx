/**
 * 술 목록(2026-09-24 주종 확장, 요구사항 §2) — 검색창 → 전체/전통주/위스키/사케/와인 탭 → 세부 종류 칩 → 필터 바로가기([가격][용량][음식][전체 필터]) → 적용 조건·결과 수 → 카드.
 * URL이 상태다(shared parseFilter/toSearchParams): kind·cat·pmin/pmax·vmin/vmax·amin/amax·food·country·flavor·a.<속성>·region·brewery·sort·page. 옛 링크 ?category=탁주·?region=·?brewery= 도 그대로 받는다.
 * 판정은 shared filterDrinks(전체 데이터 기준, 같은 규격에서 가격·용량 동시 충족). 지역 칩(관심지역)은 전통주 탭에서만, 다른 주종은 국가 필터.
 * 술 종류별 한 줄 설명(CATEGORY_NOTE)은 전통주 세부 종류 아래에만 보인다.
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  F, KIND_BY_ID, KIND_LABEL, breadcrumb, byDrink, drinkInRegion, filterDrinks, filterHref, hasDetails, inSubtype, itemList, kindOf, kindTabs, parseFilter, presentVolumes,
  rangeActive, regionById, regionLabel, scorePairings, switchKind, toSlug, type DrinkKind, type FilterItem,
} from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import JsonLd from "../_components/JsonLd";
import RegionTabs from "../_components/RegionTabs";
import DrinkCard from "./_components/DrinkCard";
import FilterBar from "./_components/FilterBar";
import SubtypeChips from "./_components/SubtypeChips";

export const revalidate = 600;
type Q = Record<string, string | string[] | undefined>;
const PER = 60;

/** 전통주 종류 한 줄 설명 — 세부 칩 아래에 보인다 */
const CATEGORY_NOTE: Record<string, string> = {
  makgeolli: "쌀·누룩으로 빚어 거르지 않은 막걸리. 탄산·단맛이 있어 전·튀김·매운 음식과 잘 맞습니다.",
  yakju: "맑게 걸러 낸 술. 은은한 향과 산미로 한식 전반, 담백한 요리에 곁들이기 좋습니다.",
  cheongju: "맑게 거른 술로, 누룩보다 쌀 입국을 주로 써 맛이 깔끔합니다. 회·해산물과 무난하게 어울립니다.",
  distilled: "소주·고량주처럼 증류해 도수가 높은 술. 기름진 고기·진한 양념 요리와 잘 맞습니다.",
  fruit: "포도·사과·복분자 등 과일로 빚은 술. 치즈·디저트·가벼운 고기 요리와 어울립니다.",
  liqueur: "술에 과일·약재·꽃 등을 넣어 향을 입힌 리큐르, 과실주를 증류한 브랜디, 꿀을 발효한 허니와인. 식후주나 디저트와 곁들입니다.",
};
const KIND_LEAD: Record<DrinkKind, string> = {
  trad: "종류별로 나눠 모았습니다. 술을 고르면 어울리는 안주와 그 근거, 구매처를 볼 수 있습니다.",
  whisky: "종류와 생산지를 함께 고를 수 있습니다. 니트·하이볼처럼 마시는 방식별 어울림도 표시합니다.",
  sake: "특정명칭(준마이·긴조…)과 제조 특징(나마·니고리…)을 따로 고를 수 있습니다.",
  wine: "색상으로 먼저 고르고, 품종·산지·단맛으로 좁힙니다. 로제 스파클링은 로제와 스파클링 어디서나 보입니다.",
};

const parse = (sp: Q) => parseFilter(sp);

export async function generateMetadata({ searchParams }: { searchParams: Promise<Q> }): Promise<Metadata> {
  const c = await getCatalog();
  const f = parse(await searchParams);
  const ro = regionById(f.region);
  const kind = f.kind ? KIND_LABEL[f.kind] : "주류";
  const sub = f.kind && f.cat ? KIND_BY_ID[f.kind].subtypes.flatMap((s) => [s, ...(s.children ?? [])]).find((s) => s.id === f.cat)?.label : null;
  const parts = [ro ? regionLabel(ro) : null, sub, f.brewery].filter(Boolean).join(" ");
  const filtered = !!parts || hasDetails(f) || !!f.q;
  const title = f.kind || filtered
    ? `${[parts, kind].filter(Boolean).join(" ")} — 어울리는 음식 추천 | 페어링GO`
    : `주류 ${c.counts.drinks}종 — 전통주·위스키·사케·와인과 어울리는 음식 | 페어링GO`;
  const description = `전통주 ${c.dataset.drinks.filter((d) => kindOf(d) === "trad").length}종을 비롯한 술과 어울리는 음식을 근거와 함께 정리했습니다. 가격·용량·도수·음식으로 골라 보세요.`;
  return { title, description, alternates: { canonical: "/drinks" }, openGraph: { title, description, url: "/drinks", siteName: "페어링GO" }, robots: filtered ? { index: false } : undefined };
}

export default async function DrinkIndex({ searchParams }: { searchParams: Promise<Q> }) {
  const c = await getCatalog();
  const sp = await searchParams;
  const f = parse(sp);
  const page = Math.max(1, Math.floor(Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1));
  const drinks = c.dataset.drinks;

  // 지역(관심지역)은 전통주에만 — 동 단위에 양조장이 없으면 상위 지역으로 대신 보여 주고 그 사실을 적는다
  const regionObj = regionById(f.region);
  let fallbackNote: string | null = null;
  let regionTest = (d: FilterItem["drink"]) => kindOf(d) !== "trad" || drinkInRegion(d, regionObj);
  if (regionObj && regionObj.pre.length && !drinks.some((d) => kindOf(d) === "trad" && drinkInRegion(d, regionObj)) && regionObj.fb?.length) {
    const fb = regionObj.fb;
    regionTest = (d) => kindOf(d) !== "trad" || fb.some((p) => (d.region || "").startsWith(p));
    fallbackNote = `${regionLabel(regionObj)}에 등록된 양조장이 아직 없어 ${fb[0]} 전체 기준으로 보여 드립니다.`;
  }

  // 세부 종류를 뺀 결과(칩 수·맛 태그·용량 버튼용) → 세부 종류로 거른 결과(목록)
  const base = filterDrinks(drinks, { ...f, cat: null }, F, { regionTest });
  const items = f.cat ? base.items.filter((it) => inSubtype(it.drink, f.cat!)) : base.items;
  const total = items.length;
  const kindDef = f.kind ? KIND_BY_ID[f.kind] : null;
  const subCounts: Record<string, number> = {};
  if (kindDef) for (const s of kindDef.subtypes) { subCounts[s.id] = base.items.filter((it) => inSubtype(it.drink, s.id)).length; for (const ch of s.children ?? []) subCounts[ch.id] = base.items.filter((it) => inSubtype(it.drink, ch.id)).length; }
  const flavorCount = new Map<string, number>();
  for (const it of base.items) for (const t of it.drink.flavor || []) flavorCount.set(t, (flavorCount.get(t) || 0) + 1);
  const flavors = [...flavorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  const volumes = presentVolumes(base.items);
  const kindHas = (k: DrinkKind) => drinks.some((d) => kindOf(d) === k);
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(page, pages);
  const shown = items.slice((cur - 1) * PER, cur * PER);
  const topFoods = (id: string) => scorePairings(byDrink[id] || [], (p) => F[p.f]?.category || "").slice(0, 2).map((s) => F[s.p.f]?.name).filter((x): x is string => !!x);
  const pageHref = (n: number) => { const q = new URLSearchParams(filterHref(f).split("?")[1] || ""); if (n > 1) q.set("page", String(n)); const s = q.toString(); return `/drinks${s ? `?${s}` : ""}`; };

  const heading = [regionObj && f.kind === "trad" ? regionLabel(regionObj) : null, f.brewery, f.kind ? KIND_LABEL[f.kind] : "주류"].filter(Boolean).join(" ");
  const base0 = siteUrl();
  const ld = [
    breadcrumb([{ name: "홈", path: "/" }, { name: "주류", path: "/drinks" }, ...(f.kind ? [{ name: KIND_LABEL[f.kind], path: `/drinks?kind=${f.kind}` }] : [])], base0),
    itemList(shown.slice(0, 30).map((it) => ({ name: it.drink.name, path: `/drinks/${toSlug(it.drink.name)}` })), { base: base0, name: heading }),
  ];
  const noKindData = !!f.kind && !kindHas(f.kind);
  const relaxed = { ...f, price: { min: null, max: null }, ml: { min: null, max: null } };

  return (
    <div className="wrap drinks-page">
      <JsonLd data={ld} />
      <p className="crumb"><Link href="/">홈</Link>{f.kind && <> · <Link href="/drinks">주류</Link></>}</p>
      {/* 제목은 한 줄, 설명은 주종을 골랐을 때만 작게(2026-09-26 정리). 검색창은 헤더에 있으니 본문에 두 번 두지 않는다 */}
      <h1 className="list-h1">{heading}{f.kind && <span className="small muted list-lead">{KIND_LEAD[f.kind]}</span>}</h1>

      {/* ② 주종 탭 — '전체'는 조회 범위 */}
      <ul className="cat-tabs kind-tabs" aria-label="주종">
        {kindTabs(base.kindCounts, base.all).map((t) => (
          <li key={t.id ?? "all"}><Link href={filterHref(switchKind(f, t.id))} scroll={false} className={f.kind === t.id ? "on" : undefined} aria-current={f.kind === t.id ? "page" : undefined}>{t.label}<span className="cnt">{t.n}</span></Link></li>
        ))}
      </ul>
      {/* ③ 세부 종류 칩 */}
      {f.kind && !noKindData && <SubtypeChips kind={f.kind} applied={f} counts={subCounts} />}
      {f.kind === "trad" && f.cat && CATEGORY_NOTE[f.cat] && <p className="small muted cat-note" style={{ marginTop: -6 }}>{CATEGORY_NOTE[f.cat]}</p>}
      {f.kind === "trad" && <RegionTabs current={regionObj?.id} base="/drinks" keep={Object.fromEntries([...new URLSearchParams(filterHref({ ...f, region: null }).split("?")[1] || "")])} collapsible />}
      {fallbackNote && <p className="small muted">{fallbackNote}</p>}
      {/* ④·⑤ 필터 바로가기 + 적용 조건 + 결과 수 */}
      {!noKindData && <FilterBar applied={f} total={total} flavors={flavors} volumes={volumes} note={rangeActive(f.price) && rangeActive(f.ml) ? "가격·용량이 같은 규격에서 확인된 술만" : rangeActive(f.price) ? "참고가격이 확인된 술만" : rangeActive(f.ml) ? "용량이 확인된 술만" : null} />}

      {noKindData && (
        <section className="empty-kind">
          <h2>{KIND_LABEL[f.kind!]} 준비 중</h2>
          <p className="muted">{KIND_LABEL[f.kind!]} 목록은 확인된 제품 정보가 들어오는 대로 열립니다. 가격·용량은 확인된 값만 싣습니다.</p>
          <div className="btns"><Link className="btn" href={filterHref(switchKind(f, "trad"))}>전통주 보기</Link><Link className="btn" href={filterHref(switchKind(f, null))}>전체 보기</Link></div>
        </section>
      )}
      {!noKindData && total === 0 && (
        <section className="empty-kind">
          <h2>조건에 맞는 술이 없습니다</h2>
          <p className="muted">조건을 하나 줄여 보세요.{(rangeActive(f.price) || rangeActive(f.ml)) && " 가격·용량은 확인된 규격이 있는 술만 걸립니다."}</p>
          <div className="btns">
            {(rangeActive(f.price) || rangeActive(f.ml)) && <Link className="btn" href={filterHref(relaxed)}>가격·용량 조건 지우기</Link>}
            {f.cat && <Link className="btn" href={filterHref({ ...f, cat: null })}>{KIND_LABEL[f.kind!]} 전체 보기</Link>}
            {hasDetails(f) && <Link className="btn" href={filterHref({ ...switchKind(f, f.kind), region: null })}>조건 모두 지우기</Link>}
          </div>
        </section>
      )}

      {/* ⑥ 술 목록 */}
      {shown.length > 0 && (
        <ul className="dgrid">
          {shown.map((it) => <DrinkCard key={it.drink.id} item={it} foods={topFoods(it.drink.id)} showKind={!f.kind} />)}
        </ul>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="페이지">
          {cur > 1 && <Link className="btn" href={pageHref(cur - 1)}>이전</Link>}
          <span className="small muted">{cur} / {pages}</span>
          {cur < pages && <Link className="btn" href={pageHref(cur + 1)}>다음 {Math.min(PER, total - cur * PER)}종</Link>}
        </nav>
      )}
      <p className="small" style={{ marginTop: 20 }}><Link href={`/drinks/categories${filterHref(f).includes("?") ? "?" + filterHref(f).split("?")[1] : ""}`}>카테고리 전체 보기 →</Link></p>
    </div>
  );
}
