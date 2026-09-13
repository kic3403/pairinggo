"use client";
/**
 * 한 화면(술 상세 또는 음식 상세)의 '먹어봤어요' 집계와 내 평가를 한 번만 받아 카드들에 나눠 준다.
 * 상세 화면은 정적 생성(ISR)이라 평가는 브라우저에서 따로 받는다. 로그인 상태가 바뀌면(경로 이동) 다시 받는다.
 */
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RatingCounts, RatingValue } from "@pairinggo/shared/ratings";
import { track } from "@/lib/track";

export type PublicPick = { d: string; f: string; n: number; likes: number; notes: { nick: string; note: string; image: string | null; at: string }[] };
type Ctx = {
  ready: boolean;
  /** 회원 추천(공개 기준 이상) — 카드의 "회원 N명 추천" 줄 */
  picksOf: (d: string, f: string) => PublicPick | undefined;
  countsOf: (d: string, f: string) => RatingCounts | undefined;
  mineOf: (d: string, f: string) => RatingValue | undefined;
  rate: (d: string, f: string, v: RatingValue | null) => Promise<"ok" | "login" | "error">;
};
const RatingsCtx = createContext<Ctx>({ ready: false, picksOf: () => undefined, countsOf: () => undefined, mineOf: () => undefined, rate: async () => "error" });
export const useRatings = () => useContext(RatingsCtx);
const key = (d: string, f: string) => `${d}|${f}`;

export default function RatingsProvider({ subject, children }: { subject: { drink: string } | { food: string }; children: ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, RatingCounts>>({});
  const [mine, setMine] = useState<Record<string, RatingValue>>({});
  const [picks, setPicks] = useState<Record<string, PublicPick>>({});
  const [ready, setReady] = useState(false);
  const qs = "drink" in subject ? `drink=${subject.drink}` : `food=${subject.food}`;

  useEffect(() => {
    let alive = true;
    // 첫 화면 로그아웃(SavedProvider)이 먼저 끝나도록 한 박자 늦게 받는다
    const t = setTimeout(async () => {
      const j = await fetch(`/api/ratings?${qs}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive) return;
      setCounts(j?.counts ?? {}); setMine(j?.mine ?? {}); setPicks(j?.picks ?? {}); setReady(true);
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [qs, pathname]);

  const rate = useCallback(async (d: string, f: string, v: RatingValue | null) => {
    const k = key(d, f);
    const prevMine = mine[k], prevCounts = counts[k];
    // 먼저 바꿔 보여 주고 실패하면 되돌린다
    setMine((m) => { const n = { ...m }; if (v) n[k] = v; else delete n[k]; return n; });
    setCounts((c) => {
      const cur = { ...(c[k] ?? { good: 0, ok: 0, bad: 0 }) };
      if (prevMine) cur[prevMine] = Math.max(0, cur[prevMine] - 1);
      if (v) cur[v]++;
      return { ...c, [k]: cur };
    });
    try {
      const r = await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ d, f, rating: v }) });
      if (r.status === 401) throw Object.assign(new Error("login"), { login: true });
      if (!r.ok) throw new Error("fail");
      const j = await r.json();
      setCounts((c) => ({ ...c, [k]: j.counts }));
      setMine((m) => { const n = { ...m }; if (j.mine) n[k] = j.mine; else delete n[k]; return n; });
      track("rate", { d, f, rating: v });
      return "ok";
    } catch (e) {
      setMine((m) => { const n = { ...m }; if (prevMine) n[k] = prevMine; else delete n[k]; return n; });
      setCounts((c) => { const n = { ...c }; if (prevCounts) n[k] = prevCounts; else delete n[k]; return n; });
      return (e as { login?: boolean }).login ? "login" : "error";
    }
  }, [mine, counts]);

  const value = useMemo<Ctx>(() => ({ ready, picksOf: (d, f) => picks[key(d, f)], countsOf: (d, f) => counts[key(d, f)], mineOf: (d, f) => mine[key(d, f)], rate }), [ready, counts, mine, picks, rate]);
  return <RatingsCtx.Provider value={value}>{children}</RatingsCtx.Provider>;
}
