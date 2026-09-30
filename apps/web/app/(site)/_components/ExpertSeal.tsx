/**
 * 전문가 인증 배지(2026-09-30 사용자 결정) — 남색 톱니 원 + 금색 안쪽 원 + 주황 체크를 단계 수만큼(1 인증 · 2 시니어 · 3 마스터).
 * 회원 추천·술 평가·식당 리뷰·페어링 카드의 전문가 이름 옆에 붙는다. 훅이 없어 서버·클라이언트 어디서나 쓴다.
 */
import { EXPERT_TIER_LABEL, cleanExpertTier, expertTierTitle, type ExpertTier } from "@pairinggo/shared/expert";

// 톱니 원(12꼭지) — 반지름 11/9.2, 24×24 뷰박스
const SCALLOP = "M12 1.2l1.9 1.5 2.3-.5 1.2 2.1 2.3.8.2 2.4 1.9 1.6-1 2.2 1 2.2-1.9 1.6-.2 2.4-2.3.8-1.2 2.1-2.3-.5L12 22.8l-1.9-1.5-2.3.5-1.2-2.1-2.3-.8-.2-2.4L2.2 14.9l1-2.2-1-2.2 1.9-1.6.2-2.4 2.3-.8 1.2-2.1 2.3.5z";

export function SealIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="xseal-i" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={SCALLOP} fill="#22406B" />
      <circle cx="12" cy="12" r="6.6" fill="#E8CC72" />
      <path d="M8.6 12.3l2.3 2.3 4.6-4.8" fill="none" stroke="#E4572E" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** tier가 없으면 아무것도 그리지 않는다(전문가가 아닌 회원) */
export default function ExpertSeal({ tier, size = 16, className }: { tier?: number | null; size?: number; className?: string }) {
  if (!tier) return null;
  const t: ExpertTier = cleanExpertTier(tier);
  return (
    <span className={`xseal${className ? ` ${className}` : ""}`} title={expertTierTitle(t)} role="img" aria-label={EXPERT_TIER_LABEL[t]}>
      {Array.from({ length: t }, (_, i) => <SealIcon key={i} size={size} />)}
    </span>
  );
}
