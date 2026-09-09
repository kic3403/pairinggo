import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { search, parseIntent, type Doc } from "@pairinggo/shared";
import { track } from "@/lib/analytics";

const EXAMPLES = ["매운 안주에 어울리는 술", "도수 낮은 달달한 막걸리", "복순도가에 어울리는 안주", "선물용 증류주"];

/**
 * 검색창 — 입력 즉시 술/음식/둘러보기 자동완성, Enter는 1순위로 이동.
 * 상황 문장("~에 어울리는 술")은 /search?q= 로 보내 상황 검색 결과를 보여준다.
 */
export default function SearchBox({ autoFocus = false, compact = false, initial = "" }: { autoFocus?: boolean; compact?: boolean; initial?: string }) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  useEffect(() => { setQ(initial); }, [initial]);

  const res = useMemo(() => search(q, { limit: 8 }), [q]);
  const intent = useMemo(() => (q.trim().length >= 4 ? parseIntent(q) : null), [q]);
  const list = [...res.drinks.slice(0, 5), ...res.foods.slice(0, 5), ...res.browse.slice(0, 3)].sort((a, b) => b.score - a.score).slice(0, 8);

  const goDoc = (d: Doc) => {
    setOpen(false); setQ("");
    track("search", { q, pick: d.type + ":" + d.id, kind: "autocomplete" });
    nav(d.type === "browse" ? `/browse/${d.kind}/${encodeURIComponent(d.key!)}` : `/${d.type}/${d.id}`);
  };
  const goQuery = () => {
    const t = q.trim(); if (!t) return;
    setOpen(false);
    if (intent) { track("search_intent", { q: t }); nav(`/search?q=${encodeURIComponent(t)}`); return; }
    if (list[0] && list[0].score >= 60) { goDoc(list[0].doc); return; }
    track("search", { q: t, kind: "submit" });
    nav(`/search?q=${encodeURIComponent(t)}`);
  };

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 bg-surface border-[1.5px] rounded-xl ${open ? "border-accent" : "border-line"} ${compact ? "px-3 py-2" : "px-4 py-3.5"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent shrink-0" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") goQuery(); }}
          placeholder={compact ? "술·음식 검색" : "술·음식 이름, 초성, 또는 “매운 안주에 어울리는 술”"} enterKeyHint="search" aria-label="검색"
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-muted" />
        {q && <button onClick={() => { setQ(""); ref.current?.focus(); }} className="text-muted text-lg leading-none px-1" aria-label="지우기">×</button>}
      </div>
      {open && (
        <div className="absolute left-0 right-0 mt-2 card overflow-hidden z-20 max-h-96 overflow-y-auto shadow-[0_10px_30px_rgba(27,39,53,.12)]">
          {!q.trim() && (
            <div className="p-3">
              <div className="text-[10.5px] font-bold tracking-widest text-muted">이렇게 물어보세요</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXAMPLES.map((ex) => <Link key={ex} to={`/search?q=${encodeURIComponent(ex)}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(false)} className="chip">{ex}</Link>)}
              </div>
            </div>
          )}
          {q.trim() && intent && (
            <button onMouseDown={(e) => e.preventDefault()} onClick={goQuery} className="w-full text-left px-3 py-3 border-b border-line bg-accent-soft/40">
              <div className="text-[10.5px] font-bold tracking-widest text-accent-ink">상황 검색</div>
              <div className="text-[14px] font-semibold mt-0.5">{q} <span className="text-muted">→</span></div>
              <div className="text-[11.5px] text-muted mt-0.5">{intent.explain.join(" · ")} · {intent.target === "drink" ? "어울리는 술" : "어울리는 음식"}</div>
            </button>
          )}
          {q.trim() && list.length === 0 && !intent && (
            <div className="p-4 text-sm text-muted text-center">
              ‘{q}’ — 아직 데이터에 없는 이름이에요.
              {res.suggestions.length > 0 && <div className="mt-2 flex flex-wrap justify-center gap-1.5">{res.suggestions.map((s) => <button key={s.id} onMouseDown={(e) => e.preventDefault()} onClick={() => goDoc(s)} className="chip">{s.name}?</button>)}</div>}
            </div>
          )}
          {list.map((h) => (
            <button key={h.doc.type + h.doc.id} onMouseDown={(e) => e.preventDefault()} onClick={() => goDoc(h.doc)}
              className="w-full flex items-center gap-3 px-3 py-3 border-b border-line last:border-0 text-left">
              <span className={`text-[10.5px] font-bold rounded-md px-1.5 py-0.5 shrink-0 ${h.doc.type === "drink" ? "badge-drink" : h.doc.type === "food" ? "badge-food" : "border border-line text-muted"}`}>
                {h.doc.type === "drink" ? "술" : h.doc.type === "food" ? "음식" : h.doc.kind === "category" ? "종류" : h.doc.kind === "region" ? "지역" : "양조장"}
              </span>
              <span className="flex-1 min-w-0"><span className="font-medium">{h.doc.name}</span><div className="text-xs text-muted truncate">{h.doc.meta}</div></span>
              {h.kind === "fuzzy" && <span className="text-[10px] text-muted">비슷한 이름</span>}
              <span className="text-muted">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
