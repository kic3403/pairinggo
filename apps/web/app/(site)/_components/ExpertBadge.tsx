/** 전문가 검수 배지(docs/27) — 어울림 2명 "전문가 추천" · 5명 "전문가 적극 추천" · 10명 "전문가 Best 페어링". 규칙은 shared pairing/expert.ts */
import { expertBadge, expertReviewSummary, type Pairing } from "@pairinggo/shared";

export default function ExpertBadge({ p }: { p: Pick<Pairing, "xp"> }) {
  const b = expertBadge(p.xp);
  if (!b) return null;
  return <span className={`xbadge ${b.key}`} title={expertReviewSummary(p.xp)}>{b.label}</span>;
}
