/**
 * 추천을 누가 했나 — 전문가픽 · 대중픽 · 맛 분석 (사용자 결정, 2026-09-13).
 *   전문가픽: 양조장 공식 · 소믈리에·명인 — 이름이 있는 전문가가 직접 한 추천
 *   대중픽:   블로그·카페·유튜브 후기 · 매체 기사 — 사람들이 실제로 먹고 쓴 글과 보도
 *             (기자·셰프 이름이 붙은 매체 인용은 검수 때 소믈리에 등급으로 올렸으므로, 남은 '매체'는 협업·프로모션 보도가 대부분이다)
 *   맛 분석:  근거 글 없이 맛 프로필로 계산한 추정
 * 인스타그램은 약관 때문에 수집하지 않는다. '먹어봤어요' 평가는 별도로 보여 준다(ratings.ts).
 */
import type { SrcTier } from "../types";

export type PickKey = "expert" | "public" | "profile";
export const PICK_LABEL: Record<PickKey, string> = { expert: "전문가픽", public: "대중픽", profile: "맛 분석" };
/** 같은 묶음 안의 세부 출처 이름 */
export const PICK_DETAIL: Record<SrcTier, string> = {
  official: "양조장 공식", sommelier: "소믈리에·명인", media: "매체 보도", blog: "블로그·유튜브 후기", profile: "맛 프로필 추정", ai: "AI 추정",
};

export function pickOf(src: SrcTier | undefined | null): PickKey {
  if (src === "official" || src === "sommelier") return "expert";
  if (src === "media" || src === "blog") return "public";
  return "profile";
}
