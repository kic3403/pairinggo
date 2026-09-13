"use client";
/**
 * 페어링 카드의 '먹어봤어요' — 어울렸다 · 보통 · 별로. 같은 버튼을 다시 누르면 평가를 지운다.
 * 로그인하지 않았으면 로그인 화면으로 보내고 이 화면으로 돌아온다.
 */
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { RATING_LABEL, RATING_VALUES, summarizeRatings, type RatingValue } from "@pairinggo/shared/ratings";
import { useRatings } from "./RatingsProvider";
import { useSaved } from "./SavedProvider";

export default function TriedRating({ d, f }: { d: string; f: string }) {
  const { ready, countsOf, mineOf, rate } = useRatings();
  const { ready: authReady, loggedIn } = useSaved();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mine = mineOf(d, f);
  const sum = summarizeRatings(countsOf(d, f));

  const click = async (v: RatingValue) => {
    if (authReady && !loggedIn) { router.push(`/login?next=${encodeURIComponent(pathname + "#pairings")}`); return; }
    setBusy(true); setMsg(null);
    const r = await rate(d, f, mine === v ? null : v);
    setBusy(false);
    if (r === "login") router.push(`/login?next=${encodeURIComponent(pathname + "#pairings")}`);
    else if (r === "error") setMsg("저장하지 못했어요. 잠시 후 다시 눌러 주세요.");
  };

  return (
    <div className="tried">
      <div className="tried-head">
        <span className="tried-q">먹어봤어요</span>
        <span className={`tried-sum ${sum.verdict}`} aria-live="polite">{ready ? sum.text : " "}</span>
      </div>
      <div className="tried-btns" role="group" aria-label="먹어본 평가">
        {RATING_VALUES.map((v) => (
          <button key={v} type="button" className={`tried-btn ${v}${mine === v ? " on" : ""}`} aria-pressed={mine === v} disabled={busy} onClick={() => void click(v)}>
            {RATING_LABEL[v]}
          </button>
        ))}
      </div>
      {msg && <p className="tried-msg">{msg}</p>}
    </div>
  );
}
