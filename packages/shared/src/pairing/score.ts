/**
 * 추천 결과 순위 — 종합 / 전문가 / 대중 탭.
 *   종합 = 0.60·전문가점수(84~97 정규화) + 0.25·대중언급(log, 대상 내 정규화) + 0.15·맛프로필(0~100)
 *          + 출처 등급 보너스 (양조장 공식 +4 · 소믈리에·명인 +3 · 전문 매체 +1.5) → 0~100
 *   편중 보정: 상위 5에 같은 그룹(음식 분류 / 술 종류)이 3개 이상이면 3번째부터 −5
 */
import type { Pairing, SrcTier } from "../types";

export type PairingTab = "overall" | "expert" | "public";
export const TAB_LABEL: Record<PairingTab, string> = { overall: "종합", expert: "전문가 추천", public: "대중 추천" };

export type Scored<T extends Pairing = Pairing> = {
  p: T;
  overall: number;
  /** 기여도 (각 0~100 스케일) */
  parts: { es: number; blog: number; pf: number; tier: number };
  /** 편중 보정으로 감점됨 */
  adjusted: boolean;
};

const ES_MIN = 84, ES_MAX = 97;
const TIER_BONUS: Record<SrcTier, number> = { official: 4, sommelier: 3, media: 1.5, profile: 0, ai: 0 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const WEIGHTS = { es: 0.6, blog: 0.25, pf: 0.15 } as const;

/** 한 대상(술 또는 음식)의 페어링 목록에 종합 점수를 매긴다. groupOf: 편중 보정용 그룹 키 */
export function scorePairings<T extends Pairing>(rows: T[], groupOf?: (p: T) => string): Scored<T>[] {
  if (!rows.length) return [];
  const logs = rows.map((r) => Math.log1p(Math.max(0, r.blog || 0)));
  const lmin = Math.min(...logs), lmax = Math.max(...logs);
  const out: Scored<T>[] = rows.map((p, i) => {
    const es = clamp01((p.es - ES_MIN) / (ES_MAX - ES_MIN));
    const blog = lmax > lmin ? (logs[i] - lmin) / (lmax - lmin) : 0.5;
    const pf = clamp01((p.pf?.s ?? 50) / 100);
    const tier = TIER_BONUS[p.src ?? "profile"];
    const raw = (WEIGHTS.es * es + WEIGHTS.blog * blog + WEIGHTS.pf * pf) * 100 + tier;
    return { p, overall: Math.max(0, Math.min(100, raw)), parts: { es: Math.round(es * 100), blog: Math.round(blog * 100), pf: Math.round(pf * 100), tier }, adjusted: false };
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

/** 카드 툴팁 문구: "전문가 97 · 언급 1,445건 · 맛 프로필 68 · 양조장 공식 +4" */
export function explainOverall(s: Scored, srcLabel: string): string {
  const parts = [`전문가 ${s.p.es}`, `언급 ${(s.p.blog || 0).toLocaleString("ko-KR")}건`, `맛 프로필 ${s.p.pf?.s ?? "-"}`];
  if (s.parts.tier) parts.push(`${srcLabel} +${s.parts.tier}`);
  if (s.adjusted) parts.push("편중 보정 −5");
  return parts.join(" · ");
}
