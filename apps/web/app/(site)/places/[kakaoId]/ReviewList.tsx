"use client";
/**
 * 방문 인증 리뷰 목록 — 별점·닉네임·인증 배지·방문 달·글·사진. 누구나 볼 수 있고, 로그인 회원은 신고(한 번), 내 리뷰는 삭제.
 * 회원 id는 목록에 없다 — 내 리뷰인지는 /api/reviews?kakao= 가 돌려주는 myReviewIds로 안다.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { REVIEW_VERIFY_LABEL, type PublicReview } from "@pairinggo/shared";
import { useSaved } from "../../_components/SavedProvider";
import { track } from "@/lib/track";

const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
const ym = (d: string) => `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월 방문`;
const ymd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10).replaceAll("-", ".");

export default function ReviewList({ kakaoId, reviews, writeHref }: { kakaoId: string; reviews: PublicReview[]; writeHref: string }) {
  const { ready, loggedIn } = useSaved();
  const [mine, setMine] = useState<number[]>([]);
  const [gone, setGone] = useState<number[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !loggedIn) return;
    fetch(`/api/reviews?kakao=${kakaoId}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => j?.myReviewIds && setMine(j.myReviewIds)).catch(() => {});
  }, [ready, loggedIn, kakaoId]);

  async function report(id: number) {
    if (!loggedIn) { alert("로그인하면 신고할 수 있어요"); return; }
    const reason = window.prompt("신고 사유를 적어 주세요(욕설·광고·허위·개인정보 노출 등). 3건이 모이면 숨겨지고 운영자가 확인해요.");
    if (reason == null) return;
    const r = await fetch(`/api/reviews/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; hidden?: boolean };
    if (!r.ok) { alert(j.error ?? "신고하지 못했어요"); return; }
    track("review_report", { kakao: kakaoId });
    if (j.hidden) setGone((g) => [...g, id]);
    alert(j.hidden ? "신고가 모여 이 리뷰를 숨겼어요. 운영자가 확인할게요." : "신고했어요. 운영자가 확인할게요.");
  }
  async function remove(id: number) {
    if (!confirm("내 리뷰를 지울까요? 사진도 함께 지워져요.")) return;
    const r = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (r.ok) setGone((g) => [...g, id]); else alert("지우지 못했어요");
  }

  const list = reviews.filter((r) => !gone.includes(r.id));
  if (!list.length) {
    return (
      <div className="pd-empty">
        <p>아직 방문 인증 리뷰가 없어요. 다녀오셨다면 첫 리뷰를 남겨 주세요.</p>
        <Link className="btn" href={writeHref}>리뷰 쓰기</Link>
      </div>
    );
  }
  return (
    <>
      <ul className="rv-list">
        {list.map((r) => (
          <li key={r.id} className="rv">
            <div className="rv-top">
              <span className="rv-stars" aria-label={`별점 ${r.rating}점`}>{stars(r.rating)}</span>
              <b className="rv-nick">{r.nickname}</b>
              <span className={`rv-badge ${r.verify}`}>{REVIEW_VERIFY_LABEL[r.verify]}</span>
            </div>
            <p className="rv-body">{r.body}</p>
            {r.photos.length ? (
              <div className="rv-photos">
                {r.photos.map((u, i) => <button key={u} type="button" onClick={() => setZoom(u)} aria-label={`사진 ${i + 1} 크게 보기`}><img src={u} alt="" loading="lazy" decoding="async" /></button>)}
              </div>
            ) : null}
            <div className="rv-foot">
              <span>{ym(r.visitDate)} · {ymd(r.createdAt)} 작성</span>
              {mine.includes(r.id)
                ? <button type="button" className="rv-act" onClick={() => remove(r.id)}>삭제</button>
                : <button type="button" className="rv-act" onClick={() => report(r.id)}>신고</button>}
            </div>
          </li>
        ))}
      </ul>
      {zoom ? (
        <div className="rv-zoom" role="dialog" aria-label="리뷰 사진" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
          <button type="button" aria-label="닫기">✕</button>
        </div>
      ) : null}
    </>
  );
}
