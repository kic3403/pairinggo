/**
 * 전문가(소믈리에·요리연구가 등) 페어링 검수(2026-09-28 사용자 결정, docs/27) — 회원이 전문가를 신청하고 운영자가 승인하면
 * 페어링을 "어울림·보통·아님"으로 판정한다. 판정·한 줄 이유는 실명(소속 또는 직함)과 함께 공개된다.
 *   · "어울림" 하나 = 소믈리에 등급 근거 한 줄(무게 1.0 → 근거 확인). 전문가마다 근거 source가 달라 confidence.ts가 각각 독립 출처로 센다.
 *   · "아님"은 근거를 만들지 않고 세기만 한다(이유 필수). "보통"은 기록만.
 *   · 배지: 어울림 2명 이상 "전문가 추천" · 5명 이상 "전문가 적극 추천" · 10명 이상 "전문가 Best 페어링" — 단 어울림이 아님의 2배 이상일 때만(반대가 세면 추천하지 않는다).
 *   · 보상: 테스트 기간 없음, 출시 뒤 협찬·건당 사례(experts.compensation — 그때 카드에 '협찬'·'유료 자문' 표시).
 * DB 동기화는 packages/server/expert-reviews.ts(partner-pairings.ts와 같은 구조).
 */
import { josa } from "../hangul";
import type { PairingSnapshot } from "./partner-pairing";

export const EXPERT_TITLES = ["소믈리에", "전통주 소믈리에", "요리연구가", "셰프", "양조장 대표", "양조사", "전통주 명인", "바텐더", "푸드 칼럼니스트", "기타"] as const;
export const EXPERT_NOTE_MAX = 120;
export const EXPERT_INTRO_MAX = 200;
export const EXPERT_DOCS_MAX = 3;
export const EXPERT_REVIEWS_PER_DAY = 100;
/** 소믈리에 근거의 바닥 점수 — 카탈로그 sommelier 행 범위(90~95)에 맞춤 */
export const EXPERT_ES = 93;
export const EXPERT_SOURCE_PREFIX = "전문가 검수 · ";
export const EXPERT_BADGE = { rec: 2, strong: 5, best: 10 } as const;
export type ExpertBadgeKey = keyof typeof EXPERT_BADGE;
export const EXPERT_BADGE_LABEL: Record<ExpertBadgeKey, string> = { rec: "전문가 추천", strong: "전문가 적극 추천", best: "전문가 Best 페어링" };

export type ExpertStatus = "applied" | "approved" | "rejected" | "suspended";
export type ExpertVerdict = "yes" | "neutral" | "no";
export type ExpertCompensation = "none" | "paid" | "sponsored";
/** 카드 배지용 집계 — pairings.expert_yes / expert_no(승인된 전문가만) */
export type ExpertCounts = { yes: number; no: number };

export const EXPERT_STATUS_LABEL: Record<ExpertStatus, string> = { applied: "심사 중", approved: "승인", rejected: "반려", suspended: "정지" };
export const VERDICT_LABEL: Record<ExpertVerdict, string> = { yes: "어울림", neutral: "보통", no: "아님" };
export const COMPENSATION_LABEL: Record<ExpertCompensation, string> = { none: "", paid: "유료 자문", sponsored: "협찬" };
export const EXPERT_VERDICTS: ExpertVerdict[] = ["yes", "neutral", "no"];
export const EXPERT_STATUSES: ExpertStatus[] = ["applied", "approved", "rejected", "suspended"];

const hasLink = (s: string) => /https?:|www\.|\.(?:com|kr|net|io)\b|@/i.test(s);
const ID = /^[a-z]\d{1,4}$/;
const oneLine = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const cleanExpertNote = (v: unknown) => oneLine(v, EXPERT_NOTE_MAX);
export const cleanExpertStatus = (v: unknown): ExpertStatus => (EXPERT_STATUSES.includes(v as ExpertStatus) ? (v as ExpertStatus) : "applied");
export const cleanCompensation = (v: unknown): ExpertCompensation => (v === "paid" || v === "sponsored" ? v : "none");

/** 공개 표시명 — 소속이 있으면 "홍길동 · ○○레스토랑", 없으면 "홍길동 소믈리에" */
export function expertDisplayName(realName: string, affiliation: string, title: string): string {
  const n = oneLine(realName, 20), a = oneLine(affiliation, 40), t = oneLine(title, 20);
  if (!n) return "";
  return a ? `${n} · ${a}` : t && t !== "기타" ? `${n} ${t}` : n;
}

export type ExpertApplication = { realName: string; affiliation: string; title: string; intro: string };
export function cleanExpertApplication(raw: Record<string, unknown>): ExpertApplication {
  return { realName: oneLine(raw.realName, 20), affiliation: oneLine(raw.affiliation, 40), title: oneLine(raw.title, 20), intro: oneLine(raw.intro, EXPERT_INTRO_MAX) };
}

/** 신청 검사 — 통과면 null, 아니면 한국어 안내 */
export function expertApplicationProblem(input: ExpertApplication & { docsCount?: number; publicConsent?: unknown }): string | null {
  const n = input.realName;
  if (n.length < 2) return "실명을 적어 주세요(2자 이상).";
  if (!/^[가-힣a-zA-Z\s]+$/.test(n)) return "실명은 한글·영문만 적을 수 있어요.";
  if (!input.title) return "직함을 골라 주세요.";
  if (hasLink(input.affiliation) || hasLink(input.intro) || hasLink(input.realName)) return "링크나 이메일은 넣을 수 없어요.";
  if (input.title === "기타" && !input.affiliation) return "직함이 '기타'면 소속을 적어 주세요(카드에 이름 옆에 보여요).";
  if ((input.docsCount ?? 0) > EXPERT_DOCS_MAX) return `증빙 사진은 ${EXPERT_DOCS_MAX}장까지예요.`;
  if (input.publicConsent !== true) return "실명·소속(또는 직함) 공개에 동의해 주세요.";
  return null;
}

/** 판정 검사 — 아님이면 한 줄 이유 필수 */
export function expertReviewProblem(input: { drinkId: unknown; foodId: unknown; verdict: unknown; note?: unknown }): string | null {
  if (!ID.test(String(input.drinkId ?? ""))) return "술을 골라 주세요.";
  if (!ID.test(String(input.foodId ?? ""))) return "카탈로그에 있는 음식을 골라 주세요.";
  if (!EXPERT_VERDICTS.includes(input.verdict as ExpertVerdict)) return "어울림·보통·아님 중 하나를 골라 주세요.";
  const note = String(input.note ?? "").trim();
  if (note.length > EXPERT_NOTE_MAX) return `한 줄 이유는 ${EXPERT_NOTE_MAX}자까지예요.`;
  if (hasLink(note)) return "한 줄 이유에는 링크나 이메일을 넣을 수 없어요.";
  if (input.verdict === "no" && note.length < 2) return "'아님'은 이유를 함께 적어 주세요.";
  return null;
}

/** 근거 줄 — source가 전문가마다 달라 독립 출처로 센다. 카드에는 "“한 줄 이유” — 홍길동 소믈리에" */
export function expertEvidence(displayName: string, note: string) {
  return { source: `${EXPERT_SOURCE_PREFIX}${displayName}`, url: null as string | null, quote: note || null, who: displayName, tier: "sommelier" as const };
}
export const isExpertEvidenceSource = (source: string | null | undefined) => String(source ?? "").startsWith(EXPERT_SOURCE_PREFIX);

/**
 * "어울림"을 기존 pairings 행(없으면 null)에 적용한 값. 이미 official·sommelier면 그대로 두고 근거 줄만 보탠다.
 * 그 외(매체·블로그·회원·맛 분석·없음)는 sommelier로 올리고 점수는 max(기존, 93).
 */
export function applyExpertReview(existing: PairingSnapshot | null, note: string, displayName: string): PairingSnapshot {
  if (existing && (existing.tier === "official" || existing.tier === "sommelier")) return existing;
  const reason = note || `${josa(displayName, "이/가")} 어울린다고 검수한 조합입니다.`;
  return { tier: "sommelier", es: Math.max(existing?.es ?? 0, EXPERT_ES), reason };
}

/** 배지 — 어울림 ≥ 2이고 어울림 ≥ 아님×2일 때만. 단계는 어울림 수로 */
export function expertBadge(xp: ExpertCounts | null | undefined): { key: ExpertBadgeKey; label: string } | null {
  const yes = xp?.yes ?? 0, no = xp?.no ?? 0;
  if (yes < EXPERT_BADGE.rec || yes < no * 2) return null;
  const key: ExpertBadgeKey = yes >= EXPERT_BADGE.best ? "best" : yes >= EXPERT_BADGE.strong ? "strong" : "rec";
  return { key, label: EXPERT_BADGE_LABEL[key] };
}

/** 툴팁 — "전문가 7명 어울림 · 1명 아님" */
export function expertReviewSummary(xp: ExpertCounts | null | undefined): string {
  const yes = xp?.yes ?? 0, no = xp?.no ?? 0;
  if (!yes && !no) return "";
  return [yes ? `전문가 ${yes}명 어울림` : "", no ? `${yes ? "" : "전문가 "}${no}명 아님` : ""].filter(Boolean).join(" · ");
}
