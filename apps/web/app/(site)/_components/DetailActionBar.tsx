/**
 * 상세 화면 하단 고정 버튼 — 휴대폰에서만(767px 이하, CSS). 데일리샷 상품 상세의 "♡ 찜 | 주문하기", 캐치테이블 식당 상세의 "저장 | 예약하기" 자리(docs/19 §5).
 * 왼쪽은 저장(♡), 오른쪽은 그 화면의 핵심 행동 하나 — 술은 구매(또는 파는 곳), 음식은 맛집 찾기. 링크 이벤트는 각 버튼이 남긴다.
 * 이 막대가 있는 화면은 하단 탭바를 숨긴다(MobileTabBar hidesTabBar).
 */
import type { ReactNode } from "react";

export default function DetailActionBar({ save, children }: { save: ReactNode; children: ReactNode }) {
  return (
    <div className="actionbar" role="region" aria-label="바로가기">
      <div className="ab-save">{save}</div>
      <div className="ab-main">{children}</div>
    </div>
  );
}
