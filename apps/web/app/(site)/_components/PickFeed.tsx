"use client";
/**
 * 회원 추천 글 목록 — 글마다 ♥ 버튼. 내가 누른 하트는 한 번만 받아 나눠 쓴다. 비로그인이면 로그인으로. 내 글에는 못 누른다.
 * 정렬은 서버에서 하트 많은 순 → 최근 순으로 이미 되어 있다.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toSlug } from "@pairinggo/shared/slug";
import { track } from "@/lib/track";
import { useSaved } from "./SavedProvider";
import ShareButton from "./ShareButton";
import ExpertSeal, { SealIcon } from "./ExpertSeal";

export type FeedPost = { id: number; d: string; f: string; drink: string; food: string; nick: string; note: string; image: string | null; likes: number; at: string; mine: boolean; tier?: number };

export default function PickFeed({ posts, compact = false }: { posts: FeedPost[]; compact?: boolean }) {
  const { ready, loggedIn } = useSaved();
  const router = useRouter();
  const pathname = usePathname();
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [onlyExpert, setOnlyExpert] = useState(false);
  const [likes, setLikes] = useState<Record<number, number>>(() => Object.fromEntries(posts.map((p) => [p.id, p.likes])));
  const [me, setMe] = useState<boolean | null>(null);
  const [mineIds, setMineIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<Record<number, string>>({});

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const j = await fetch("/api/picks/like").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive) return;
      setLiked(new Set<number>(j?.ids ?? [])); setMineIds(new Set<number>(j?.mine ?? [])); setMe(!!j?.loggedIn);
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [pathname]);

  const heart = async (p: FeedPost) => {
    if ((ready && !loggedIn) || me === false) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return; }
    if (p.mine || mineIds.has(p.id)) { setMsg((m) => ({ ...m, [p.id]: "내 글에는 하트를 누를 수 없어요" })); return; }
    const was = liked.has(p.id);
    setLiked((s) => { const n = new Set(s); if (was) n.delete(p.id); else n.add(p.id); return n; });
    setLikes((l) => ({ ...l, [p.id]: Math.max(0, (l[p.id] ?? 0) + (was ? -1 : 1)) }));
    setBusy(p.id);
    try {
      const r = await fetch("/api/picks/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return; }
      if (!r.ok) throw new Error(j.error || "실패");
      setLikes((l) => ({ ...l, [p.id]: j.likes }));
      setLiked((s) => { const n = new Set(s); if (j.liked) n.add(p.id); else n.delete(p.id); return n; });
      if (j.liked) track("pick_like", { d: p.d, f: p.f, pick: p.id });
      if (j.published) { setMsg((m) => ({ ...m, [p.id]: "하트가 모여 이 조합이 페어링 카드에 올라갔어요" })); router.refresh(); }
    } catch (e) {
      setLiked((s) => { const n = new Set(s); if (was) n.add(p.id); else n.delete(p.id); return n; });
      setLikes((l) => ({ ...l, [p.id]: p.likes }));
      setMsg((m) => ({ ...m, [p.id]: (e as Error).message }));
    } finally { setBusy(null); }
  };

  if (!posts.length) return null;
  // 전문가 글만 모아 보기(2026-10-01) — 전문가 글이 하나라도 있을 때만 칩을 보인다
  const hasExpert = posts.some((p) => p.tier);
  const shown = onlyExpert ? posts.filter((p) => p.tier) : posts;
  return (
    <>
    {!compact && hasExpert && (
      <div className="pk-filter" role="group" aria-label="추천 글 거르기">
        <button type="button" className={!onlyExpert ? "on" : undefined} onClick={() => setOnlyExpert(false)}>전체 {posts.length}</button>
        <button type="button" className={onlyExpert ? "on" : undefined} onClick={() => setOnlyExpert(true)}><SealIcon size={14} /> 전문가 글만 {posts.filter((p) => p.tier).length}</button>
      </div>
    )}
    <ul className={`picks-list${compact ? " compact" : ""}`}>
      {shown.map((p) => (
        <li key={p.id} className={p.mine || mineIds.has(p.id) ? "mine" : undefined}>
          <div className="pair">{p.d ? <Link href={`/drinks/${toSlug(p.drink)}`}>{p.drink}</Link> : <span>{p.drink}</span>}<span className="x">×</span>{p.f ? <Link href={`/foods/${toSlug(p.food)}`}>{p.food}</Link> : <span>{p.food}</span>}</div>
          {p.note && <p className="why" style={{ marginTop: 6 }}>“{p.note}”</p>}
          {!compact && p.image && <a href={p.image} target="_blank" rel="noopener noreferrer" className="mpick-photo" style={{ display: "inline-block", marginTop: 8 }}><img src={p.image} alt={`${p.nick}님의 사진`} loading="lazy" /></a>}
          <div className="pk-foot">
            <span className="small muted">{p.nick}<ExpertSeal tier={p.tier} size={15} />{p.mine || mineIds.has(p.id) ? " (나)" : ""} · {p.at.slice(0, 10)}</span>
            {!compact && <ShareButton className="btn xs" label="" title={`${p.drink} × ${p.food} — ${p.nick}님의 추천`} text={p.note ? `“${p.note}” — 페어링GO 회원 추천` : "페어링GO 회원 추천"} path="/picks" d={p.d} f={p.f} pick={p.id} />}
            <button type="button" className={`heart-btn pk-heart${liked.has(p.id) ? " on" : ""}`} aria-pressed={liked.has(p.id)} disabled={busy === p.id} onClick={() => void heart(p)} aria-label={`${p.drink} × ${p.food} 추천에 하트`}>
              {liked.has(p.id) ? "♥" : "♡"} <b>{likes[p.id] ?? p.likes}</b>
            </button>
          </div>
          {msg[p.id] && <p className="small muted" style={{ margin: "4px 0 0" }}>{msg[p.id]}</p>}
        </li>
      ))}
    </ul>
    </>
  );
}
