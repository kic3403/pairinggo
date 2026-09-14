"use client";
/**
 * 마이페이지 "먹어봤나요?" — 저장한 술·음식으로 고른 조합 최대 3개를 그 자리에서 평가(어울렸다·보통·별로). 고르는 규칙은 shared pairing/tried-suggest.ts.
 * 평가하면 그 줄이 "고마워요"로 바뀌고 rate 이벤트(from: my)를 남긴다. 다 평가하면 카드가 사라진다.
 */
import Link from "next/link";
import { useState } from "react";
import { RATING_LABEL, RATING_VALUES, type RatingValue } from "@pairinggo/shared/ratings";
import { toSlug } from "@pairinggo/shared/slug";
import { track } from "@/lib/track";

export type TriedItem = { d: string; f: string; drink: string; food: string };

export default function TriedCard({ items }: { items: TriedItem[] }) {
  const [done, setDone] = useState<Record<string, RatingValue | "error">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const left = items.filter((it) => done[`${it.d}|${it.f}`] === undefined || done[`${it.d}|${it.f}`] === "error");
  if (!items.length || (!left.length && Object.keys(done).length === 0)) return null;

  const rate = async (it: TriedItem, v: RatingValue) => {
    const k = `${it.d}|${it.f}`;
    setBusy(k);
    try {
      const r = await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ d: it.d, f: it.f, rating: v }) });
      if (!r.ok) throw new Error();
      setDone((m) => ({ ...m, [k]: v }));
      track("rate", { d: it.d, f: it.f, rating: v, from: "my" });
    } catch { setDone((m) => ({ ...m, [k]: "error" })); }
    finally { setBusy(null); }
  };

  return (
    <section className="tried-card" aria-label="먹어봤나요">
      <div className="section-head" style={{ marginTop: 0 }}><h2>먹어봤나요?</h2><span className="small muted">저장한 술·음식으로 고른 조합</span></div>
      <p className="small muted" style={{ margin: "-4px 0 10px" }}>실제로 드셔 본 조합만 눌러 주세요. 평가는 성별·연령대별 통계에만 쓰입니다.</p>
      <ul className="tried-list">
        {items.map((it) => {
          const k = `${it.d}|${it.f}`, v = done[k];
          return (
            <li key={k}>
              <div className="pair"><Link href={`/drinks/${toSlug(it.drink)}`}>{it.drink}</Link><span className="x">×</span><Link href={`/foods/${toSlug(it.food)}`}>{it.food}</Link></div>
              {v && v !== "error" ? (
                <span className="small tried-thanks">{RATING_LABEL[v]} · 고마워요</span>
              ) : (
                <div className="tried-btns" role="group" aria-label={`${it.drink} × ${it.food} 평가`}>
                  {RATING_VALUES.map((r) => <button key={r} type="button" className={`tried-btn ${r}`} disabled={busy === k} onClick={() => void rate(it, r)}>{RATING_LABEL[r]}</button>)}
                  {v === "error" && <span className="small form-error" style={{ margin: 0, padding: "4px 8px" }}>저장 실패 — 다시 눌러 주세요</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
