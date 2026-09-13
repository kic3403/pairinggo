"use client";
/** 페어링 카드의 "회원 N명 추천" 줄 — 공개 기준을 넘긴 조합만. 닉네임·한 줄 글·사진 1장 */
import { memberPickSummary } from "@pairinggo/shared/member";
import { useRatings } from "./RatingsProvider";

/** hideNotes: 회원픽 카드는 인용문 칸에 첫 이유가 이미 있어 글은 생략하고 인원·사진만 */
export default function MemberPickLine({ d, f, hideNotes = false }: { d: string; f: string; hideNotes?: boolean }) {
  const { picksOf } = useRatings();
  const p = picksOf(d, f);
  if (!p) return null;
  const photo = p.notes.find((n) => n.image);
  return (
    <div className="mpick">
      <span className="pick member">{memberPickSummary(p.n, p.likes)}</span>
      {!hideNotes && p.notes.filter((n) => n.note).slice(0, 2).map((n, i) => <span key={i} className="mpick-note">“{n.note}” <span className="muted">— {n.nick}</span></span>)}
      {photo?.image && <a href={photo.image} target="_blank" rel="noopener noreferrer" className="mpick-photo"><img src={photo.image} alt={`${photo.nick}님의 사진`} loading="lazy" /></a>}
    </div>
  );
}
