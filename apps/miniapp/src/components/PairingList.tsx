import { useMemo, useState } from "react";
import { Link } from "react-router";
import { fmt, shortAward, SRC_LABEL, scorePairings, sortByTab, explainOverall, TAB_LABEL, type PairingTab, type Pairing, type SrcTier, type Evidence, type PF } from "@pairinggo/shared";
import SaveButton from "./SaveButton";
import ExtLink from "./ExtLink";
import { track } from "@/lib/analytics";

export type Row = Pairing & {
  /** 상대(카드에 표시되는 쪽) */
  id: string; type: "drink" | "food"; name: string; sub: string; award?: string;
  /** 편중 보정 그룹 (음식 분류 / 술 종류) */
  group: string;
  /** 술 카드용: 온라인 구매 링크 */
  buyUrl?: string; buyStore?: string; onlineSellable?: boolean;
  src?: SrcTier; ev?: Evidence; pf?: PF;
};

const TABS: PairingTab[] = ["overall", "expert", "public"];
const TAB_NOTE: Record<PairingTab, string> = {
  overall: "전문가 점수 60% · 대중 언급 25% · 맛 프로필 15% + 출처 등급 가산 · 편중 보정",
  expert: "양조장 공식 → 소믈리에·명인 → 전문 매체 → 맛 프로필 순으로 우선합니다 · 맛 프로필 점수는 척도 계산값",
  public: "네이버 블로그 실측 언급량순 (2026.8 기준)",
};

export default function PairingList({ rows, subjectType, subjectId }: { rows: Row[]; subjectType: "drink" | "food"; subjectId: string }) {
  const [tab, setTab] = useState<PairingTab>("overall");
  const scored = useMemo(() => scorePairings(rows, (r) => r.group), [rows]);
  const sorted = useMemo(() => sortByTab(scored, tab), [scored, tab]);
  const maxBlog = Math.max(1, ...rows.map((r) => r.blog));

  return (
    <div className="mt-4">
      <div className="flex bg-surface2 rounded-xl p-1 gap-1" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-[13.5px] font-bold ${tab === t ? "bg-surface text-ink shadow" : "text-muted"}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] text-muted mt-2 px-1">{TAB_NOTE[tab]}</p>
      <div className="flex flex-col gap-3 mt-3">
        {sorted.map((s, i) => {
          const r = s.p;
          const score = tab === "overall" ? s.overall : tab === "expert" ? r.es : fmt(r.blog);
          const scoreLabel = tab === "overall" ? "종합" : tab === "expert" ? "매칭점수" : "블로그 언급";
          return (
            <div key={r.id} className="card p-4">
              <div className="flex items-center gap-2.5">
                <span className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center font-black text-sm ${i === 0 ? (r.type === "food" ? "text-food" : "text-drink") : "text-muted"}`}>{i + 1}</span>
                <Link to={`/${r.type}/${r.id}`} onClick={() => track("card_tap", { from: subjectType + ":" + subjectId, to: r.type + ":" + r.id, rank: i + 1, tab })} className="flex-1 min-w-0 font-serif font-bold text-[17px]">
                  {r.name} <small className="font-sans font-medium text-[11.5px] text-muted">{r.sub}</small>
                  {r.award && <span className="award ml-1.5 align-middle">{shortAward(r.award)}</span>}
                  <span className={`ml-1.5 align-middle inline-flex items-center text-[10px] font-bold rounded-[3px] px-1.5 py-px border ${r.src === "official" || r.src === "sommelier" ? "border-drink text-drink-ink" : "border-line text-muted"}`}>{SRC_LABEL[r.src ?? "profile"]}</span>
                </Link>
                <span className="text-right" title={tab === "overall" ? explainOverall(s, SRC_LABEL[r.src ?? "profile"]) : undefined}>
                  <span className={`block font-black text-[17px] num ${r.type === "food" ? "text-food" : "text-drink"}`}>{score}</span>
                  <span className="block text-[10.5px] font-bold text-muted -mt-0.5">{scoreLabel}</span>
                </span>
              </div>
              <p className="text-[13.5px] text-ink2 mt-2.5">{r.reason}</p>
              {r.ev?.source && (
                <p className="text-[11px] text-muted mt-2 leading-relaxed">
                  근거 · {r.ev.who ? `${r.ev.who} · ` : ""}
                  {r.ev.url ? <ExtLink href={r.ev.url} kind="evidence" className="text-ink2 underline underline-offset-2">{r.ev.source}</ExtLink> : r.ev.source}
                  {r.ev.quote ? ` “${r.ev.quote.slice(0, 70)}”` : ""}
                </p>
              )}
              {r.pf && (
                <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                  <b className="text-ink2">맛 프로필 {r.pf.s}</b>{r.pf.plus.length ? ` · ${r.pf.plus.join(" · ")}` : ""}{r.pf.minus[0] ? <span className="text-muted"> − {r.pf.minus[0]}</span> : null}
                </p>
              )}
              {tab === "overall" && (
                <p className="text-[10.5px] text-muted mt-1.5">종합 근거 · 전문가 {s.parts.es} · 언급 {s.parts.blog} · 프로필 {s.parts.pf}{s.parts.tier ? ` · 출처 +${s.parts.tier}` : ""}{s.adjusted ? " · 편중 보정 −5" : ""}</p>
              )}
              {tab === "public" && <div className="h-[5px] rounded bg-surface2 mt-2.5 overflow-hidden"><i className={`block h-full rounded ${r.type === "food" ? "bg-food" : "bg-drink"}`} style={{ width: `${Math.max(6, Math.round((r.blog / maxBlog) * 100))}%` }} /></div>}
              <div className="flex items-center justify-between mt-2.5 text-[11.5px]">
                <span className="text-muted">{tab === "expert" ? `블로그 언급 ${fmt(r.blog)}건` : `전문가 매칭점수 ${r.es}점`}</span>
                <span className="flex items-center gap-3 font-bold">
                  <SaveButton item={subjectType === "drink" ? { k: "pair", d: subjectId, f: r.id } : { k: "pair", d: r.id, f: subjectId }} />
                  {r.type === "food" && <Link to={`/restaurants?food=${encodeURIComponent(r.name)}`} className="text-food-ink">내 주변 식당</Link>}
                  {r.type === "drink" && r.buyUrl && r.onlineSellable !== false && <ExtLink href={r.buyUrl} kind="buy" meta={{ drink: r.id }} className="text-drink-ink" title={`${r.buyStore || "구매 페이지"}로 이동`}>구매</ExtLink>}
                  {r.type === "drink" && <Link to={`/drink/${r.id}#offline`} className="text-drink-ink">판매점</Link>}
                  <Link to={`/${r.type}/${r.id}`} className={r.type === "food" ? "text-food-ink" : "text-drink-ink"}>{r.type === "drink" ? "이 술 자세히 →" : "자세히 →"}</Link>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted mt-3 px-1 leading-relaxed">
        맛 프로필 점수는 술(단맛·산미·바디·탄산·향)과 음식(기름기·매운맛·감칠맛·짠맛·단맛·무게) 1~5 척도를 규칙으로 대조한 계산값(0~100)입니다. 대중 언급량은 네이버 블로그 검색 API 실측값입니다. 일반 명사와 이름이 겹치는 술은 과다 집계될 수 있어요.
      </p>
    </div>
  );
}
