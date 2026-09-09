import { Link } from "react-router";
import { drinksInRegion } from "@pairinggo/shared";
import { useRegion } from "@/lib/prefs";
import Section from "./Section";

/** 홈: 관심지역(또는 현재 위치 추정 지역)의 우리술 */
export default function RegionDrinks() {
  const { eff } = useRegion();
  if (!eff) return null;
  const { list, label } = drinksInRegion(eff.pre, 12, eff.fb);
  const title = `${label || eff.label}의 우리술 · ${list.length}종${label ? ` (${eff.label} 인근)` : ""}`;
  return (
    <Section label={title} more={list.length ? "전체" : undefined} to={`/browse/region/${encodeURIComponent(label || eff.pre[0] || eff.label)}`}>
      {list.length ? (
        <div className="hscroll mt-3">
          {list.map((d) => (
            <Link key={d.id} to={`/drink/${d.id}`} className="card flex-none w-[150px] p-3">
              <div className="text-[11px] font-black text-drink tracking-wider">{d.region}</div>
              <div className="font-serif font-bold text-[14.5px] mt-1 leading-snug line-clamp-2">{d.name}</div>
              <div className="text-[11px] text-muted mt-1">{d.category}{d.abv != null ? ` · ${d.abv}%` : ""}</div>
            </Link>
          ))}
        </div>
      ) : <p className="text-[13px] text-muted mt-3">아직 이 지역에 등록된 술이 없어요. 계속 채우고 있습니다.</p>}
    </Section>
  );
}
