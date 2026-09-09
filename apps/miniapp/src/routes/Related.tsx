import { Link } from "react-router";
import { D, F, byFood, POPULAR, POPULAR_FOODS, shortAward, similarDrinks, similarFoods, naverMapUrl } from "@pairinggo/shared";
import { recentStore, savedStore, useRegion } from "@/lib/prefs";
import SaveButton from "@/components/SaveButton";
import ExtLink from "@/components/ExtLink";

/** 최근 검색(최신 4건) 기반 연관 추천 — 술: 비슷한 술 / 음식: 관심지역 맛집 + 비슷한 음식 + 베스트 술 */
export default function Related() {
  const rec = recentStore.use().slice(0, 4);
  const saved = savedStore.use();
  const { label, near, mapNear, st } = useRegion();

  return (
    <main className="px-5 pt-7">
      <h1 className="font-bold text-[24px] tracking-tight">연관 추천</h1>
      <p className="text-[12.5px] text-muted mt-1">{rec.length ? `최근 검색 ${rec.length}건 기준 · 관심지역 ${label}` : "최근 검색을 바탕으로 비슷한 술과 맛집을 추천합니다"}</p>

      {!rec.length && (
        <>
          <div className="py-10 text-center">
            <div className="text-[17px] font-bold">아직 검색 기록이 없어요</div>
            <p className="text-[13px] text-muted mt-2">술이나 음식을 검색하면 그와 비슷한 술, 그 음식의 맛집을 여기서 이어서 추천해 드려요.</p>
          </div>
          <div className="text-[11.5px] font-bold tracking-widest text-muted">이런 검색으로 시작해보세요</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {POPULAR.slice(0, 4).map((d) => <Link key={d.id} to={`/drink/${d.id}`} className="chip"><b className="text-drink">술</b>{d.alias}</Link>)}
            {POPULAR_FOODS.slice(0, 4).map((f) => <Link key={f.id} to={`/food/${f.id}`} className="chip"><b className="text-food">음식</b>{f.name}</Link>)}
          </div>
        </>
      )}

      {rec.map((r) => {
        if (r.type === "drink") {
          const d = D[r.id]; if (!d) return null;
          const sim = similarDrinks(d, 5);
          return (
            <section key={`d${r.id}`} className="mt-7">
              <div className="flex items-center gap-2"><span className="text-[10.5px] font-bold rounded-md px-1.5 py-0.5 badge-drink">술</span><span className="font-bold text-[15px]">‘{d.name}’과 비슷한 {d.category}</span></div>
              <p className="text-[11.5px] text-muted mt-1">종류 · 지역 · 도수 · 맛 프로필이 가까운 순 · {d.category}{d.abv != null ? ` ${d.abv}%` : ""} · {d.region || d.brewery}</p>
              {sim.length ? sim.map((o, i) => (
                <div key={o.x.id} className="flex items-center gap-3 py-3 border-b border-line">
                  <span className="w-5 text-[12px] text-muted num">{i + 1}</span>
                  <Link to={`/drink/${o.x.id}`} className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px]">{o.x.name}<small className="font-normal text-[11.5px] text-muted ml-1.5">{o.x.category}{o.x.abv != null ? ` · ${o.x.abv}%` : ""} · {o.x.region || o.x.brewery}</small></div>
                    <div className="flex flex-wrap gap-1 mt-1">{o.why.slice(0, 4).map((w) => <span key={w} className="text-[10.5px] text-drink-ink bg-drink-soft rounded px-1.5">{w}</span>)}{o.x.awards?.[0] && <span className="text-[10.5px] text-drink-ink bg-drink-soft rounded px-1.5">{shortAward(o.x.awards[0])}</span>}</div>
                  </Link>
                  <SaveButton item={{ k: "drink", id: o.x.id }} />
                </div>
              )) : <p className="text-[13px] text-muted mt-3">아직 비슷한 술이 충분하지 않아요.</p>}
            </section>
          );
        }
        const f = F[r.id]; if (!f) return null;
        const simF = similarFoods(f, 4);
        const top = [...(byFood[f.id] || [])].sort((a, b) => b.es - a.es).slice(0, 3);
        const places = saved.filter((s) => s.k === "place" && s.food && f.name.includes(s.food));
        return (
          <section key={`f${r.id}`} className="mt-7">
            <div className="flex items-center gap-2"><span className="text-[10.5px] font-bold rounded-md px-1.5 py-0.5 badge-food">음식</span><span className="font-bold text-[15px]">‘{f.name}’ 맛집 · {near}</span></div>
            <p className="text-[11.5px] text-muted mt-1">관심지역 기준 네이버지도로 이어집니다{st.gps ? " · 현재 위치 기준" : ""}</p>
            <div className="flex flex-col gap-2 mt-3">
              <Link to={`/restaurants?food=${encodeURIComponent(f.name)}`} className="btn btn-food">{near} {f.name} 식당 찾기 →</Link>
              <ExtLink className="btn btn-ghost" href={mapNear(`${f.name} 맛집`)} kind="map" meta={{ q: f.name }}>{near} {f.name} 맛집 · 네이버지도</ExtLink>
            </div>
            {!!places.length && <>
              <div className="text-[11px] font-bold tracking-widest text-muted mt-4">저장한 {f.name} 식당</div>
              {places.map((s) => s.k === "place" && <ExtLink key={s.name} href={s.url || naverMapUrl(s.name)} kind="map" className="flex items-center gap-3 py-3 border-b border-line"><span className="w-5 text-muted">·</span><span className="flex-1 font-semibold text-[15px]">{s.name}</span></ExtLink>)}
            </>}
            {!!simF.length && <>
              <div className="text-[11px] font-bold tracking-widest text-muted mt-4">비슷한 음식</div>
              {simF.map((o, i) => (
                <div key={o.x.id} className="flex items-center gap-3 py-3 border-b border-line">
                  <span className="w-5 text-[12px] text-muted num">{i + 1}</span>
                  <Link to={`/food/${o.x.id}`} className="flex-1 min-w-0"><div className="font-semibold text-[15px]">{o.x.name}<small className="font-normal text-[11.5px] text-muted ml-1.5">{o.x.category}</small></div><div className="flex flex-wrap gap-1 mt-1">{o.why.slice(0, 3).map((w) => <span key={w} className="text-[10.5px] text-food-ink bg-food-soft rounded px-1.5">{w}</span>)}</div></Link>
                  <SaveButton item={{ k: "food", id: o.x.id }} />
                </div>
              ))}
            </>}
            {!!top.length && <>
              <div className="text-[11px] font-bold tracking-widest text-muted mt-4">{f.name}에 가장 잘 맞는 술</div>
              {top.map((p, i) => (
                <div key={p.d} className="flex items-center gap-3 py-3 border-b border-line">
                  <span className="w-5 text-[12px] text-muted num">{i + 1}</span>
                  <Link to={`/drink/${p.d}`} className="flex-1 min-w-0 font-semibold text-[15px]">{D[p.d].name}<small className="font-normal text-[11.5px] text-muted ml-1.5">{D[p.d].category} · {p.es}점</small></Link>
                  <SaveButton item={{ k: "pair", d: p.d, f: f.id }} />
                </div>
              ))}
            </>}
          </section>
        );
      })}
      {!!rec.length && <p className="text-[11px] text-muted mt-5 leading-relaxed">연관 추천은 최근 검색 8건 중 최신 4건을 기준으로 하며, 비슷한 술은 종류·지역·도수·맛 프로필 유사도로 계산합니다.</p>}
    </main>
  );
}
