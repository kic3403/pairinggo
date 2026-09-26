"use client";
/**
 * 술 평가 칸(docs/25 §1) — 별 5개 + 한 줄, 최근 평가 목록. 회원당 하나(수정·삭제).
 * 머리 카드의 "★ 4.3 · 회원 N명" 줄이 #reviews로 여기까지 온다. 근거 등급·먹어봤어요와는 별개의 "회원 평가".
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DRINK_REVIEW_BODY_MAX, DRINK_REVIEW_MIN_N, starGlyphs, type StarSummary } from "@pairinggo/shared/drink-review";
import { useSaved } from "./SavedProvider";
import { track } from "@/lib/track";

type Item = { id: number; nick: string; stars: number; body: string; at: string; mine: boolean };
type View = { summary: StarSummary; list: Item[]; mine: { stars: number; body: string } | null; loggedIn: boolean };
const LABEL = ["", "별로", "그저 그래요", "괜찮아요", "좋아요", "최고예요"];
const day = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, ".");

export default function DrinkReviews({ drinkId, drinkName, initial }: { drinkId: string; drinkName: string; initial: StarSummary }) {
  const { ready, loggedIn } = useSaved();
  const path = usePathname();
  const [view, setView] = useState<View>({ summary: initial, list: [], mine: null, loggedIn: false });
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/drink-reviews?d=${drinkId}`, { cache: "no-store" }).then((r) => r.json()).then((j: View) => {
      if (!alive || !j?.summary) return;
      setView(j);
      if (j.mine) { setStars(j.mine.stars); setBody(j.mine.body); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [drinkId]);

  const submit = async () => {
    if (!stars) { setMsg("별을 눌러 점수를 골라 주세요."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/drink-reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ d: drinkId, stars, body }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "저장하지 못했어요");
      setView(j); setEditing(false); setMsg(view.mine ? "평가를 고쳤어요." : "평가를 남겼어요. 고마워요!");
      track("drink_review", { d: drinkId, stars });
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm("내 평가를 지울까요?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/drink-reviews", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ d: drinkId }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "지우지 못했어요");
      setView(j); setStars(0); setBody(""); setEditing(false); setMsg("지웠어요.");
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };

  const { summary, list, mine } = view;
  const showForm = loggedIn && (!mine || editing);
  return (
    <section id="reviews" className="box reviews" aria-label="회원 평가">
      <h3>
        회원 평가
        {summary.avg != null
          ? <b className="stars-avg">★ {summary.avg.toFixed(1)}</b>
          : summary.n > 0 ? <span className="muted small"> 평균은 {DRINK_REVIEW_MIN_N}명부터 보여요</span> : null}
        <span className="muted small"> {summary.n}명</span>
      </h3>
      {summary.n > 0 && (
        <ul className="star-hist" aria-label="별점 분포">
          {[5, 4, 3, 2, 1].map((s) => { const c = summary.hist[s - 1]; return <li key={s}><span>{s}점</span><i><b style={{ width: `${summary.n ? Math.round((c / summary.n) * 100) : 0}%` }} /></i><span className="muted">{c}</span></li>; })}
        </ul>
      )}

      {!ready ? null : !loggedIn ? (
        <p className="small muted">{drinkName}, 마셔 보셨나요? <Link href={`/login?next=${encodeURIComponent(`${path}#reviews`)}`}>로그인</Link>하고 별점과 한 줄을 남겨 주세요.</p>
      ) : showForm ? (
        <div className="review-form">
          <div className="star-btns" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" role="radio" aria-checked={stars === s} aria-label={`${s}점 ${LABEL[s]}`} className={(hover || stars) >= s ? "on" : undefined}
                onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => setStars(s)}>★</button>
            ))}
            <span className="small muted">{LABEL[hover || stars] || "별을 눌러 주세요"}</span>
          </div>
          <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={DRINK_REVIEW_BODY_MAX} placeholder="한 줄로 어땠는지 (선택, 140자)" aria-label="한 줄 평" />
          <div className="btns">
            <button type="button" className="btn p" disabled={busy} onClick={submit}>{mine ? "고치기" : "평가 남기기"}</button>
            {mine && <button type="button" className="btn" disabled={busy} onClick={() => { setEditing(false); setStars(mine.stars); setBody(mine.body); }}>취소</button>}
          </div>
        </div>
      ) : mine ? (
        <p className="small my-review">내 평가 <b className="stars">{starGlyphs(mine.stars)}</b>{mine.body && <> · {mine.body}</>}
          <button type="button" className="linklike" onClick={() => setEditing(true)}>고치기</button>
          <button type="button" className="linklike" disabled={busy} onClick={remove}>지우기</button>
        </p>
      ) : null}
      {msg && <p className="small muted" role="status">{msg}</p>}

      {list.length > 0 && (
        <ul className="review-list">
          {list.map((r) => (
            <li key={r.id} className="review-item">
              <div className="ri-head"><b className="stars" aria-label={`${r.stars}점`}>{starGlyphs(r.stars)}</b> <b>{r.nick}</b>{r.mine && <span className="small muted">(내 평가)</span>}<span className="small muted">· {day(r.at)}</span></div>
              {r.body && <p className="review-body">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
