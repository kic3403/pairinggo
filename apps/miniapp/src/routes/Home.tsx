import { Link, useSearchParams } from "react-router";
import { DATA, D, F, PRESIDENT, TREND_NOTE, CATEGORIES, todayPairing } from "@pairinggo/shared";
import SearchBox from "@/components/SearchBox";
import RegionPicker from "@/components/RegionPicker";
import RegionDrinks from "@/components/RegionDrinks";
import Section from "@/components/Section";
import { recentStore } from "@/lib/prefs";
import { usePopular } from "@/lib/popular";

const EXAMPLES = ["매운 안주에 어울리는 술", "도수 낮은 달달한 막걸리", "회에 어울리는 드라이한 술", "선물용 증류주"];
const CAT_DESC: Record<string, string> = { 탁주: "막걸리", 약주: "맑은 술", 청주: "쌀술", 증류주: "소주·화요", 과실주: "와인·복분자", 리큐르: "담금", 브랜디: "증류 과실", 허니와인: "벌꿀술" };

/** 홈 — 검색 → 상황 예시 → 종류 탐색 → 지역 → 오늘의 페어링 → 대통령상 → 인기 검색어 → 최근 검색 */
export default function Home() {
  const [sp] = useSearchParams();
  const today = todayPairing();
  const recent = recentStore.use();
  const popular = usePopular();

  return (
    <main className="px-5 pt-6">
      <div className="flex items-baseline justify-between">
        <div className="font-serif font-bold text-2xl tracking-tight">페어링<span className="text-food">GO</span></div>
        <div className="text-[11.5px] text-muted tracking-widest">전통주 페어링</div>
      </div>
      <RegionPicker />
      <h1 className="font-serif font-bold text-[25px] leading-snug mt-5">오늘 이 술엔,<br />무슨 <span className="text-food">안주</span>가 어울릴까</h1>
      <p className="text-[13px] text-muted mt-1.5">전통주 {DATA.drinks.length}종 · 음식 {DATA.foods.length}종 · 근거 있는 페어링 {DATA.pairings.length}건</p>

      <div className="mt-4"><SearchBox autoFocus={sp.get("focus") === "1"} /></div>
      <div className="hscroll mt-2.5">
        {EXAMPLES.map((ex) => <Link key={ex} to={`/search?q=${encodeURIComponent(ex)}`} className="chip flex-none">{ex}</Link>)}
      </div>

      <Section label="종류별로 찾기">
        <div className="grid grid-cols-4 gap-2 mt-3">
          {CATEGORIES.map((c) => (
            <Link key={c.key} to={`/browse/category/${encodeURIComponent(c.key)}`} className="card p-2.5 text-center">
              <div className="font-bold text-[13.5px]">{c.key}</div>
              <div className="text-[10.5px] text-muted mt-0.5 truncate">{CAT_DESC[c.key] || ""} · {c.count}</div>
            </Link>
          ))}
        </div>
      </Section>

      <RegionDrinks />

      <Section label="오늘의 페어링">
        <Link to={`/drink/${today.d}`} className="card block overflow-hidden mt-3">
          <div className="border-b border-line px-4 py-4">
            <div className="text-[11px] tracking-widest text-muted">오늘의 페어링</div>
            <div className="font-serif font-bold text-lg mt-1">{D[today.d].name} <span className="text-food text-sm px-1">✕</span> {F[today.f].name}</div>
          </div>
          <div className="px-4 py-3 text-[13px] text-ink2">“{today.reason}</div>
        </Link>
      </Section>

      <Section label="우리술품평회 대통령상">
        <div className="hscroll mt-3">
          {PRESIDENT.map(({ d, year }) => (
            <Link key={d.id} to={`/drink/${d.id}`} className="card flex-none w-[150px] p-3">
              <div className="text-[11px] font-black text-gold tracking-wider">{year} 대통령상</div>
              <div className="font-serif font-bold text-[14.5px] mt-1 leading-snug line-clamp-2">{d.name}</div>
              <div className="text-[11px] text-muted mt-1">{d.category} · {d.region || d.brewery}</div>
            </Link>
          ))}
        </div>
      </Section>

      <Section label={popular.source === "logs" ? "인기 검색어 · 실제 검색 기준" : "인기 검색어 · 최근 1개월"}>
        <div className="text-[11.5px] font-bold text-ink2 mt-3">술</div>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {popular.drinks.map((d, i) => <Link key={d.id} to={`/drink/${d.id}`} className="chip"><b className="text-drink text-[11.5px]">{i + 1}</b>{d.name}</Link>)}
        </div>
        <div className="text-[11.5px] font-bold text-ink2 mt-3">음식</div>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {popular.foods.map((f, i) => <Link key={f.id} to={`/food/${f.id}`} className="chip"><b className="text-food text-[11.5px]">{i + 1}</b>{f.name}</Link>)}
        </div>
        <p className="text-[10.5px] text-muted mt-2.5 leading-relaxed">{popular.source === "logs" ? "페어링GO 사용자들이 최근 30일 동안 실제로 검색한 순서예요." : TREND_NOTE}</p>
      </Section>

      {recent.length > 0 && (
        <Section label="최근 검색" more="연관 추천" to="/related">
          <div className="flex flex-wrap gap-2 mt-3">
            {recent.map((r) => <Link key={r.type + r.id} to={`/${r.type}/${r.id}`} className="chip"><b className={r.type === "drink" ? "text-drink" : "text-food"}>{r.type === "drink" ? "술" : "음식"}</b>{r.name}</Link>)}
          </div>
        </Section>
      )}
    </main>
  );
}
