import { Link, useParams } from "react-router";
import { D, F, byDrink, fmt, naverMapUrl, naverShopUrl, shortAward, onlineSellable, buyLink, LINK_STATUS, similarDrinks } from "@pairinggo/shared";
import PairingList, { type Row } from "@/components/PairingList";
import SearchBox from "@/components/SearchBox";
import SaveButton from "@/components/SaveButton";
import RecentTracker from "@/components/RecentTracker";
import { RegionNote } from "@/components/NearbyLink";
import ProfileRadar from "@/components/ProfileRadar";
import ExtLink from "@/components/ExtLink";
import { BackHeader } from "@/components/Section";
import NotFound from "./NotFound";

/** 술 상세 — 스펙·수상·맛 프로필 레이더·온라인/오프라인 구매·어울리는 음식(종합/전문가/대중)·비슷한 술 */
export default function Drink() {
  const { id = "" } = useParams();
  const d = D[id];
  if (!d) return <NotFound />;
  const rows: Row[] = (byDrink[id] || []).map((p) => ({
    ...p, id: p.f, type: "food", name: F[p.f].name, sub: F[p.f].category, group: F[p.f].category,
  }));
  const o = d.offline || { visit: null, place: null, address: null, phone: null, note: null };
  const sellable = onlineSellable(d);
  const breweryQ = o.place || o.address || `${d.brewery} ${d.region || ""}`;
  const bl = buyLink(d);
  const sim = similarDrinks(d, 3);

  return (
    <main className="px-4 pt-4">
      <RecentTracker type="drink" id={d.id} name={d.name} />
      <BackHeader title={d.name} sub={`이 술과 어울리는 음식 ${rows.length}가지`} right={<SaveButton item={{ k: "drink", id: d.id }} label="저장" size="lg" />} />
      <div className="mt-3"><SearchBox compact /></div>

      <section className="card p-4 mt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px] font-bold rounded-md px-1.5 py-0.5 badge-drink">술</span>
          <span className="font-serif font-bold text-[17px]">{d.name}</span>
          <Link to={`/browse/category/${encodeURIComponent(d.category)}`} className="text-xs text-muted underline underline-offset-2">{d.category}</Link>
          {d.abv != null && <span className="text-xs text-muted">{d.abv}%</span>}
          {!sellable && <span className="text-[10px] font-bold rounded-[3px] px-1.5 py-px border border-line text-muted">온라인 직배송 불가</span>}
        </div>
        <p className="text-[13px] text-ink2 mt-1.5">{d.desc}</p>
        {!!d.awards?.length && <div className="flex flex-wrap gap-1.5 mt-2">{d.awards.map((a) => <span key={a} className="award" title={a}>{shortAward(a)}</span>)}</div>}
        <div className="flex flex-wrap gap-1.5 mt-2">{d.flavor.map((t) => <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="text-[11.5px] text-accent-ink bg-accent-soft rounded-md px-2 py-0.5">{t}</Link>)}</div>
        {d.profile && <>
          <div className="text-[10.5px] font-bold tracking-widest text-muted mt-3">맛 프로필 <span className="font-medium tracking-normal ml-1">1~5 척도 · 페어링 점수 계산에 사용</span></div>
          <ProfileRadar profile={d.profile} />
        </>}
        <div className="mt-2.5 pt-2.5 border-t border-dashed border-line text-xs text-muted">
          네이버 블로그 안주 후기 <b className="text-drink num">{fmt(d.blog_anju)}건</b> · {d.region} · <Link to={`/browse/brewery/${encodeURIComponent(d.brewery)}`} className="underline underline-offset-2">{d.brewery}</Link>
        </div>
      </section>

      {/* 온라인 구매 — 앱인토스 예외 조항(추천 후 구매 플랫폼 이동) 문구 유지 */}
      <section className="mt-4 rounded-2xl border-[1.5px] border-drink-soft bg-drink-soft p-3.5">
        <div className="text-[11.5px] font-bold tracking-wider text-drink-ink">온라인 구매</div>
        <div className="flex gap-2 mt-2.5">
          {sellable && d.buy.url && !bl.fallback
            ? <><ExtLink className="btn btn-primary flex-1" href={bl.url} kind="buy" meta={{ drink: d.id, store: bl.store }}>{bl.store}로 이동 →</ExtLink><ExtLink className="btn btn-ghost flex-1" href={naverShopUrl(d.name)} kind="buy" meta={{ drink: d.id, store: "naver" }}>네이버쇼핑</ExtLink></>
            : sellable
              ? <ExtLink className="btn btn-ghost flex-1" href={naverShopUrl(d.name)} kind="buy" meta={{ drink: d.id, store: "naver" }}>네이버쇼핑에서 찾기 →</ExtLink>
              : <div className="flex-1 text-[13px] text-ink2 py-1">이 술은 전통주로 분류되지 않아 온라인 직배송이 법적으로 제한됩니다. 마트·바틀샵에서 구매하거나, 준비 중인 <b>매장 픽업(스마트오더)</b>를 이용해 주세요.</div>}
        </div>
        <p className="text-[10.5px] text-muted mt-2 leading-relaxed">
          {bl.fallback ? `공식 판매 링크가 최근 점검에서 응답하지 않아(${LINK_STATUS.checkedAt?.slice(0, 10) || "점검"}) 네이버쇼핑으로 안내합니다. `
            : bl.soldout ? "최근 점검에서 품절·판매중지 문구가 감지됐어요. 재입고 여부는 판매처에서 확인해 주세요. " : ""}
          {sellable ? "전통주는 온라인 직배송이 가능해요 · 주류는 만 19세 이상만 구매할 수 있습니다 · 페어링GO는 판매자가 아니며 판매처로 안내합니다" : "온라인 판매 불가 주류는 오프라인 구매처만 안내합니다."}
        </p>
      </section>

      {/* 오프라인 구매 */}
      <section id="offline" className="mt-3 rounded-2xl border-[1.5px] border-navy-soft bg-navy-soft p-3.5 scroll-mt-4">
        <div className="text-[11.5px] font-bold tracking-wider text-navy">오프라인 구매</div>
        {o.visit === true && (
          <div className="card mt-2.5 p-3 text-[12.5px]">
            <div className="font-bold text-[14px]">{o.place || d.brewery} <span className="text-[10.5px] font-bold text-drink-ink border border-drink rounded px-1 ml-1">직판 확인</span></div>
            {o.address && <div className="text-ink2 mt-1">{o.address}</div>}
            {o.note && <div className="text-muted mt-1 leading-relaxed">{o.note}</div>}
            <div className="flex gap-2 mt-2.5">
              <ExtLink className="btn btn-navy flex-1 !py-2 !text-[12.5px]" href={naverMapUrl(breweryQ)} kind="map" meta={{ drink: d.id }}>길찾기</ExtLink>
              {o.phone && <ExtLink className="btn btn-ghost flex-1 !py-2 !text-[12.5px]" href={`tel:${o.phone}`} kind="tel">전화 {o.phone}</ExtLink>}
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-2.5">
          {o.visit !== true && o.visit !== false && <ExtLink className="btn btn-navy flex-1" href={naverMapUrl(breweryQ)} kind="map" meta={{ drink: d.id }}>양조장 위치</ExtLink>}
          <Link to={`/restaurants?kind=bottleshop&trad=${sellable ? 1 : 0}`} className="btn btn-ghost flex-1">{sellable ? "주변 전통주 판매점" : "주변 주류판매점"} →</Link>
        </div>
        <p className="text-[10.5px] text-muted mt-2 leading-relaxed">
          {o.visit === true ? "재고·운영시간은 방문 전 확인을 권해요." : o.visit === false ? `양조장 현장 판매는 없어요. 가까운 ${sellable ? "전통주 전문점" : "마트·편의점"}을 이용해 주세요.` : (o.note || "현장 판매 여부는 확인되지 않았어요. 방문 구매는 전화로 먼저 확인해 주세요.")}
          {" "}판매점: <RegionNote />
        </p>
      </section>

      <PairingList rows={rows} subjectType="drink" subjectId={d.id} />

      {sim.length > 0 && (
        <section className="mt-7">
          <div className="sec-label">비슷한 술</div>
          <p className="text-[11.5px] text-muted mt-1">종류 · 지역 · 도수 · 맛 프로필이 가까운 순</p>
          {sim.map((o2, i) => (
            <div key={o2.x.id} className="flex items-center gap-3 py-3 border-b border-line">
              <span className="w-5 text-[12px] text-muted num">{i + 1}</span>
              <Link to={`/drink/${o2.x.id}`} className="flex-1 min-w-0">
                <div className="font-semibold text-[15px]">{o2.x.name}<small className="font-normal text-[11.5px] text-muted ml-1.5">{o2.x.category}{o2.x.abv != null ? ` · ${o2.x.abv}%` : ""} · {o2.x.region || o2.x.brewery}</small></div>
                <div className="flex flex-wrap gap-1 mt-1">{o2.why.slice(0, 4).map((w) => <span key={w} className="text-[10.5px] text-drink-ink bg-drink-soft rounded px-1.5">{w}</span>)}</div>
              </Link>
              <SaveButton item={{ k: "drink", id: o2.x.id }} />
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
