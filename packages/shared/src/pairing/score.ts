/**
 * 추천 결과 순위 — 종합 / 전문가 / 대중 탭.
 *   종합 = 0.60·전문가점수(84~97 정규화) + 0.25·대중언급 + 0.15·맛프로필(0~100)
 *          + 출처 등급 보너스 (양조장 공식 +4 · 소믈리에·명인 +3 · 전문 매체 +1.5 · 블로그 +0.5) → 0~100
 *   대중언급 = log(1+언급수) / log(1+전체 95퍼센타일)  — **모든 조합에 같은 자**(2026-09-13).
 *     예전에는 술·음식마다 최솟값 0·최댓값 100으로 다시 늘려서, 2,032건 언급된 조합이 그 술에서 꼴찌라는 이유로 0이 되고
 *     같은 조합이 술 화면과 음식 화면에서 점수가 달랐다.
 *   편중 보정: 상위 5에 같은 그룹(음식 분류 / 술 종류)이 3개 이상이면 3번째부터 −5 (순위용. 등급·기본 점수에는 반영하지 않는다)
 *
 * 화면에는 숫자 대신 등급(찰떡 · 잘 어울림 · 시도해 볼 만)을 보여 준다 — "46점"을 낙제로 읽는 문제(2026-09-13).
 */
import { BLOG_REF } from "../data";
import type { Pairing, SrcTier } from "../types";

export type PairingTab = "overall" | "expert" | "public";
export const TAB_LABEL: Record<PairingTab, string> = { overall: "종합", expert: "전문가 추천", public: "대중 추천" };

export type GradeKey = "best" | "good" | "try";
export type Grade = { key: GradeKey; label: string };
export const GRADE_LABEL: Record<GradeKey, string> = { best: "찰떡", good: "잘 어울림", try: "시도해 볼 만" };
/**
 * 등급 경계 — 기본 점수(편중 보정 전) 기준. 2026-09-13 실데이터 918건: 찰떡 72(8%) · 잘 어울림 289(31%) · 시도해 볼 만 557(61%).
 * 출처별 중앙값: 양조장 공식 81 · 소믈리에 62 · 매체 49 · 맛 프로필 30.
 */
export const GRADE_CUT = { best: 60, good: 40 } as const;

export type Scored<T extends Pairing = Pairing> = {
  p: T;
  /** 순위용 점수(편중 보정 반영) */
  overall: number;
  /** 조합 자체의 점수 — 어느 화면에서 봐도 같다. 등급은 이걸로 매긴다 */
  base: number;
  grade: Grade;
  /** 기여도 (각 0~100 스케일) */
  parts: { es: number; blog: number; pf: number; tier: number };
  /** 편중 보정으로 감점됨 */
  adjusted: boolean;
};

const ES_MIN = 84, ES_MAX = 97;
const TIER_BONUS: Record<SrcTier, number> = { official: 4, sommelier: 3, media: 1.5, blog: 0.5, profile: 0, ai: 0 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const WEIGHTS = { es: 0.6, blog: 0.25, pf: 0.15 } as const;

/** 대중 언급 몫(0~1) — 전체 기준 로그 눈금. ref를 주지 않으면 현재 카탈로그의 기준(BLOG_REF) */
export function blogPart(blog: number | undefined, ref: number = BLOG_REF): number {
  return ref > 0 ? clamp01(Math.log1p(Math.max(0, blog || 0)) / ref) : 0;
}

export function pairingGrade(score: number): Grade {
  const key: GradeKey = score >= GRADE_CUT.best ? "best" : score >= GRADE_CUT.good ? "good" : "try";
  return { key, label: GRADE_LABEL[key] };
}

type ScoreOpts = { blogRef?: number };

function parts(p: Pairing, opts: ScoreOpts) {
  const es = clamp01((p.es - ES_MIN) / (ES_MAX - ES_MIN));
  const blog = blogPart(p.blog, opts.blogRef);
  const pf = clamp01((p.pf?.s ?? 50) / 100);
  const tier = TIER_BONUS[p.src ?? "profile"];
  const raw = (WEIGHTS.es * es + WEIGHTS.blog * blog + WEIGHTS.pf * pf) * 100 + tier;
  return { raw: Math.max(0, Math.min(100, raw)), es, blog, pf, tier };
}

/** 조합 하나의 점수(0~100, 반올림) — 목록과 무관하게 항상 같다 */
export function pairingScore(p: Pairing, opts: ScoreOpts = {}): number {
  return Math.round(parts(p, opts).raw);
}

/** 한 대상(술 또는 음식)의 페어링 목록에 종합 점수를 매긴다. groupOf: 편중 보정용 그룹 키 */
export function scorePairings<T extends Pairing>(rows: T[], groupOf?: (p: T) => string, opts: ScoreOpts = {}): Scored<T>[] {
  if (!rows.length) return [];
  const out: Scored<T>[] = rows.map((p) => {
    const x = parts(p, opts);
    const base = Math.round(x.raw);
    return {
      p, overall: x.raw, base, grade: pairingGrade(base),
      parts: { es: Math.round(x.es * 100), blog: Math.round(x.blog * 100), pf: Math.round(x.pf * 100), tier: x.tier },
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

function byOverall<T extends Pairing>(a: Scored<T>, b: Scored<T>) {
  return b.overall - a.overall || b.p.es - a.p.es || b.p.blog - a.p.blog;
}

/** 탭별 정렬 */
export function sortByTab<T extends Pairing>(scored: Scored<T>[], tab: PairingTab): Scored<T>[] {
  const c = [...scored];
  if (tab === "expert") return c.sort((a, b) => b.p.es - a.p.es || b.overall - a.overall);
  if (tab === "public") return c.sort((a, b) => b.p.blog - a.p.blog || b.overall - a.overall);
  return c.sort(byOverall);
}

/** 카드 툴팁 문구: "종합 82 · 전문가 97 · 언급 1,445건 · 맛 프로필 68 · 양조장 공식 +4" */
export function explainOverall(s: Scored, srcLabel: string): string {
  const parts = [`종합 ${s.base}`, `전문가 ${s.p.es}`, `언급 ${(s.p.blog || 0).toLocaleString("ko-KR")}건`, `맛 프로필 ${s.p.pf?.s ?? "-"}`];
  if (s.parts.tier) parts.push(`${srcLabel} +${s.parts.tier}`);
  if (s.adjusted) parts.push("편중 보정 −5(순위만)");
  return parts.join(" · ");
}
