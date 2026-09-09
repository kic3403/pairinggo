import { Link, useParams } from "react-router";
import { D, F, byFood, buyLink, onlineSellable, similarFoods } from "@pairinggo/shared";
import PairingList, { type Row } from "@/components/PairingList";
import SearchBox from "@/components/SearchBox";
import SaveButton from "@/components/SaveButton";
import RecentTracker from "@/components/RecentTracker";
import NearbyLink, { RegionNote } from "@/components/NearbyLink";
import PlaceMemo from "@/components/PlaceMemo";
import ProfileBars from "@/components/ProfileBars";
import { BackHeader } from "@/components/Section";
import NotFound from "./NotFound";

/** 음식 상세 — 맛 태그·프로필·내 주변 식당·어울리는 술(종합/전문가/대중)·비슷한 음식 */
export default function Food() {
  const { id = "" } = useParams();
  const f = F[id];
  if (!f) return <NotFound />;
  const rows: Row[] = (byFood[id] || []).map((p) => {
    const d = D[p.d];
    return {
      ...p, id: p.d, type: "drink", name: d.name, sub: `${d.category}${d.abv != null ? ` · ${d.abv}%` : ""}`, group: d.category,
      award: d.awards?.[0], buyUrl: buyLink(d).url, buyStore: buyLink(d).store, onlineSellable: onlineSellable(d),
    };
  });
  const sim = similarFoods(f, 4);

  return (
    <main className="px-4 pt-4">
      <RecentTracker type="food" id={f.id} name={f.name} />
      <BackHeader title={f.name} sub={`이 음식과 어울리는 술 ${rows.length}가지`} right={<SaveButton item={{ k: "food", id: f.id }} label="저장" size="lg" />} />
      <div className="mt-3"><SearchBox compact /></div>

      <section className="card p-4 mt-3">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold rounded-md px-1.5 py-0.5 badge-food">음식</span>
          <span className="font-serif font-bold text-[17px]">{f.name}</span>
          <Link to={`/browse/food-category/${encodeURIComponent(f.category)}`} className="text-xs text-muted underline underline-offset-2">{f.category}</Link>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">{f.tags.map((t) => <span key={t} className="text-[11.5px] text-accent-ink bg-accent-soft rounded-md px-2 py-0.5">{t}</span>)}</div>
        {f.profile && <ProfileBars kind="food" profile={f.profile} />}
        <Link to={`/restaurants?food=${encodeURIComponent(f.name)}`} className="btn btn-food mt-3">{f.name} 파는 내 주변 식당 →</Link>
        <div className="flex gap-2 mt-2">
          <NearbyLink className="btn btn-ghost flex-1 !py-2.5 !text-[13px]" name={f.name} suffix="맛집" tail=" 네이버지도" />
        </div>
        <p className="text-[10.5px] text-muted mt-2"><RegionNote /></p>
        <PlaceMemo food={f.name} />
      </section>

      {rows.length ? <PairingList rows={rows} subjectType="food" subjectId={f.id} />
        : <p className="card p-4 mt-4 text-[13px] text-muted">이 음식의 페어링은 아직 준비 중이에요. 비슷한 음식의 추천을 참고해 주세요.</p>}

      {sim.length > 0 && (
        <section className="mt-7">
          <div className="sec-label">비슷한 음식</div>
          {sim.map((o, i) => (
            <div key={o.x.id} className="flex items-center gap-3 py-3 border-b border-line">
              <span className="w-5 text-[12px] text-muted num">{i + 1}</span>
              <Link to={`/food/${o.x.id}`} className="flex-1 min-w-0"><div className="font-semibold text-[15px]">{o.x.name}<small className="font-normal text-[11.5px] text-muted ml-1.5">{o.x.category}</small></div><div className="flex flex-wrap gap-1 mt-1">{o.why.slice(0, 3).map((w) => <span key={w} className="text-[10.5px] text-food-ink bg-food-soft rounded px-1.5">{w}</span>)}</div></Link>
              <SaveButton item={{ k: "food", id: o.x.id }} />
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
