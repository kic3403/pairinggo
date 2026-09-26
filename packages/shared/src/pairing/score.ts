/**
 * 추천 결과 순위 — 2026-09-27 교체(docs/26 §3-1·3-2). "근거 신뢰도"와 "어울림 점수"를 나눠 센다.
 *
 *   신뢰도(pairing/confidence.ts) = 독립 출처 수와 등급으로만 — 근거 확인(E ≥ 1) · 근거 약함(0 < E < 1) · 추정(E = 0)
 *   어울림 점수 S(0~100) = 0.60·근거 강도(1 − e^−E) + 0.15·대중 언급(로그 눈금) + 0.25·맛 분석(pf.s)
 *   등급  찰떡 = 근거 확인 + S ≥ 60 · 잘 어울림 = 근거 확인, 또는 근거 약함 + S ≥ 50 · 시도해 볼 만 = 그 밖(추정은 늘 여기)
 *   순위  등급 → 신뢰도 → S → 언급 수
 *
 * 바꾼 이유(2026-09-27 실측, 4,936조합): 예전 점수의 60%는 '전문가 점수'(사람이 매긴 값이 아니라 출처 등급에 딸린 상수 84~97 —
 *   맛 분석 추정에도 86이 붙었다), 25%는 두 낱말이 한 글에 같이 나온 수라 점수의 85%가 근거의 강도를 재지 못했다.
 *   새 식에서 추정 조합의 S는 최대 36이라 어떤 가중으로도 찰떡·잘 어울림이 되지 않는다.
 *   분포(번들 4,840, 대중 출처 반복 절반·같은 인용 합치기 뒤): 근거 확인 243(S 중앙 59) · 근거 약함 319(중앙 49) · 추정 4,278(최대 36)
 *     → 찰떡 119(양조장 공식 102·소믈리에 14·매체 3) · 잘 어울림 278 · 시도해 볼 만 4,443.
 *   회원 평가(먹어봤어요·술 별점)는 아직 양이 적어(14건) 넣지 않았다 — 5명 이상부터 Wilson 하한으로 붙일 자리(docs/26 §3-2).
 *   대중 언급은 다음 단계에서 lift(흔한 이름 부풀림 제거)로 바꾼다(§3-3).
 *   편중 보정: 상위 5에 같은 그룹(음식 분류 / 술 종류)이 3개 이상이면 3번째부터 −5 (순위용. 등급·기본 점수에는 반영하지 않는다)
 *
 * 화면에는 숫자 대신 등급과 신뢰도("근거 확인 · 출처 2곳" / "추정")를 보여 준다.
 */
import { BLOG_REF } from "../data";
import type { Pairing } from "../types";
import { CONFIDENCE_LABEL, CONFIDENCE_RANK, confidenceOf, strengthOf, type Confidence } from "./confidence";

export type PairingTab = "overall" | "expert" | "public";
export const TAB_LABEL: Record<PairingTab, string> = { overall: "종합", expert: "전문가 추천", public: "대중 추천" };

export type GradeKey = "best" | "good" | "try";
export type Grade = { key: GradeKey; label: string };
export const GRADE_LABEL: Record<GradeKey, string> = { best: "찰떡", good: "잘 어울림", try: "시도해 볼 만" };

/** 등급 경계(어울림 점수 S) — best는 근거 확인 조합에만, good은 근거 약함 조합에만 쓰인다(근거 확인은 경계 아래여도 잘 어울림) */
export const GRADE_CUT = { best: 60, good: 50 } as const;
export const WEIGHTS = { ev: 0.6, blog: 0.15, pf: 0.25 } as const;

export type Scored<T extends Pairing = Pairing> = {
  p: T;
  /** 순위용 점수(편중 보정 반영) */
  overall: number;
  /** 조합 자체의 점수 — 어느 화면에서 봐도 같다 */
  base: number;
  grade: Grade;
  confidence: Confidence;
  /** 기여도(각 0~100) · 독립 출처 수 n · 근거 강도 e */
  parts: { ev: number; blog: number; pf: number; n: number; e: number };
  /** 편중 보정으로 감점됨 */
  adjusted: boolean;
};

/** 근거 링크가 붙은 조합인가(대표 근거 기준) — 카드의 "출처 보기" 링크 여부 */
export const hasEvidence = (p: Pairing) => !!p.ev?.url;
const GRADE_RANK: Record<GradeKey, number> = { best: 2, good: 1, try: 0 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 대중 언급 몫(0~1) — 전체 기준 로그 눈금. ref를 주지 않으면 현재 카탈로그의 기준(BLOG_REF) */
export function blogPart(blog: number | undefined, ref: number = BLOG_REF): number {
  return ref > 0 ? clamp01(Math.log1p(Math.max(0, blog || 0)) / ref) : 0;
}

/** 등급 — 신뢰도가 먼저, 점수는 그 안에서만. 추정은 점수와 무관하게 '시도해 볼 만' */
export function pairingGrade(score: number, confidence: Confidence): Grade {
  const key: GradeKey = confidence === "confirmed" ? (score >= GRADE_CUT.best ? "best" : "good")
    : confidence === "weak" && score >= GRADE_CUT.good ? "good" : "try";
  return { key, label: GRADE_LABEL[key] };
}

type ScoreOpts = { blogRef?: number };
function parts(p: Pairing, opts: ScoreOpts) {
  const { n, e } = strengthOf(p);
  const ev = 1 - Math.exp(-e);
  const blog = blogPart(p.blog, opts.blogRef);
  const pf = clamp01((p.pf?.s ?? 50) / 100);
  const raw = (WEIGHTS.ev * ev + WEIGHTS.blog * blog + WEIGHTS.pf * pf) * 100;
  return { raw: Math.max(0, Math.min(100, raw)), ev, blog, pf, n, e, confidence: confidenceOf(p) };
}

/** 조합 하나의 점수(0~100, 반올림) — 목록과 무관하게 항상 같다 */
export function pairingScore(p: Pairing, opts: ScoreOpts = {}): number {
  return Math.round(parts(p, opts).raw);
}
/** 조합 하나의 등급 — 목록 밖(검색·핫한 페어링)에서 쓴다 */
export function gradeOf(p: Pairing, opts: ScoreOpts = {}): Grade {
  const x = parts(p, opts);
  return pairingGrade(Math.round(x.raw), x.confidence);
}

/** 한 대상(술 또는 음식)의 페어링 목록에 점수·등급을 매긴다. groupOf: 편중 보정용 그룹 키 */
export function scorePairings<T extends Pairing>(rows: T[], groupOf?: (p: T) => string, opts: ScoreOpts = {}): Scored<T>[] {
  if (!rows.length) return [];
  const out: Scored<T>[] = rows.map((p) => {
    const x = parts(p, opts);
    const base = Math.round(x.raw);
    return {
      p, overall: x.raw, base, grade: pairingGrade(base, x.confidence), confidence: x.confidence,
      parts: { ev: Math.round(x.ev * 100), blog: Math.round(x.blog * 100), pf: Math.round(x.pf * 100), n: x.n, e: x.e },
      adjusted: false,
    };
  });
  out.sort(byOverall);
  if (groupOf) {
    const top = out.slice(0, 5);
    const seen = new Map<string, number>();
    for (const s of top) {
      const g = groupOf(s.p);
      const n = (seen.get(g) || 0) + 1; seen.set(g, n);
      if (n >= 3) { s.overall = Math.max(0, s.overall - 5); s.adjusted = true; }
    }
    out.sort(byOverall);
  }
  for (const s of out) s.overall = Math.round(s.overall);
  return out;
}

/** 종합 순위: 등급 → 신뢰도 → 점수(편중 보정 반영) → 언급 */
function byOverall<T extends Pairing>(a: Scored<T>, b: Scored<T>) {
  return GRADE_RANK[b.grade.key] - GRADE_RANK[a.grade.key]
    || CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]
    || b.overall - a.overall || b.parts.e - a.parts.e || b.p.blog - a.p.blog;
}

/** 탭별 정렬 — 전문가 탭은 근거 강도, 대중 탭은 언급 수 */
export function sortByTab<T extends Pairing>(scored: Scored<T>[], tab: PairingTab): Scored<T>[] {
  const c = [...scored];
  if (tab === "expert") return c.sort((a, b) => b.parts.e - a.parts.e || b.overall - a.overall);
  if (tab === "public") return c.sort((a, b) => b.p.blog - a.p.blog || b.overall - a.overall);
  return c.sort(byOverall);
}

/** 카드 툴팁 문구: "어울림 58 · 근거 확인 · 출처 2곳(양조장 공식) · 언급 1,445건 · 맛 분석 62" */
export function explainOverall(s: Scored, srcLabel: string): string {
  const conf = s.confidence === "estimate" ? "추정(근거 글 없음)" : `${CONFIDENCE_LABEL[s.confidence]} · 출처 ${s.parts.n}곳(${srcLabel})`;
  const parts = [`어울림 ${s.base}`, conf, `언급 ${(s.p.blog || 0).toLocaleString("ko-KR")}건`, `맛 분석 ${s.p.pf?.s ?? "-"}`];
  if (s.adjusted) parts.push("편중 보정 −5(순위만)");
  return parts.join(" · ");
}
