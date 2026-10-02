/**
 * 어색한 자동 문장 고치기(2026-10-02) — 예전 가져오기가 채운 틀 문장
 *   "해물파전와(과) 함께 즐긴 후기·추천이 있는 조합 — 블로그 근거"
 * 를 조사를 맞춘 문장으로 바꾼다. 내용(누가 무엇과 함께 다뤘는지)은 그대로, 말만 고친다 — 없는 사실을 보태지 않는다.
 * 틀 문장이 아니면 null(손대지 않음). `packages/db reason-fix`가 DB의 pairings.reason에 적용한다.
 */
import { josa } from "../hangul";

const TEMPLATE = /^(.+?)(?:와\(과\)|과\(와\)) 함께 즐긴 후기·추천이 있는 조합 — (블로그|매체|카페) 근거$/;
const TAIL: Record<string, string> = {
  블로그: "함께 즐겼다는 블로그 후기가 있는 조합입니다.",
  카페: "함께 즐겼다는 카페 후기가 있는 조합입니다.",
  매체: "함께 소개한 매체 글이 있는 조합입니다.",
};

export function fixTemplateReason(reason: string | null | undefined): string | null {
  const m = TEMPLATE.exec((reason ?? "").trim());
  if (!m) return null;
  return `${josa(m[1], "과/와")} ${TAIL[m[2]]}`;
}
