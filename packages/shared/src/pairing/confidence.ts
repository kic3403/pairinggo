/**
 * 근거 신뢰도(2026-09-27, docs/26 §3-1) — "어울림 점수"와 따로 센다.
 *   근거 강도 E = 독립 출처마다 등급 무게를 더한 값 (양조장 공식·소믈리에 1.0 · 전문 매체 0.6 · 블로그·회원 0.3 · 맛 분석 0)
 *     단 매체·블로그·회원(대중 출처)은 가장 센 하나만 온전히, 나머지는 절반만 — 보도자료 하나를 여러 매체가 옮겨 쓴 경우가 많아서
 *     (실측: 복순도가×떡볶이 = 이마트 협업 발표 1건을 매체 3곳이 보도). 전문가(양조장·소믈리에)는 각자 따로 판단하므로 온전히 더한다.
 *   독립 출처 = 같은 매체·같은 블로그·같은 사람은 하나로 센다(한 조합에 더술닷컴 링크가 둘이어도 1곳). 인용문이 글자 그대로 같으면 같은 출처.
 *   신뢰도  확인됨(E ≥ 1) · 근거 약함(0 < E < 1) · 추정(E = 0, 근거 글 없이 맛 분석).
 * 왜: 예전 점수는 60%가 출처 등급을 옮겨 적은 '전문가 점수', 25%가 어울림과 무관한 동시 등장 수라
 *     근거의 강도를 재지 못했고, 맛 분석 추정 조합도 점수가 높으면 '찰떡'처럼 보일 수 있었다.
 * 허수 제거(2026-09-27, docs/26 §3-3): 검증 크론 결과를 곱한다 — 링크가 2번 연속 죽으면 0, 인용문이 2번 연속 없으면 절반(evidence-check.ts).
 *   판매처 큐레이션(술담화·키햐 등 상품 페이지의 '어울리는 안주')은 매체라도 0.4 — 파는 쪽의 소개라 중립 보도보다 약하다.
 */
import type { Pairing, SrcTier } from "../types";
import { evidenceFactor } from "./evidence-check";

export const EVIDENCE_WEIGHT: Record<SrcTier, number> = { official: 1, sommelier: 1, media: 0.6, blog: 0.3, user: 0.3, profile: 0, ai: 0 };
/** 확인됨으로 보는 근거 강도 — 양조장·소믈리에 1곳, 또는 매체 3곳(0.6+0.3+0.3), 또는 매체 1 + 블로그·회원 3 … */
export const CONFIRMED_FROM = 1;
/** 대중 출처(매체·블로그·회원) 두 번째부터 곱하는 값 */
export const PUBLIC_REPEAT = 0.5;
const EXPERT: SrcTier[] = ["official", "sommelier"];

export type Confidence = "confirmed" | "weak" | "estimate";
export const CONFIDENCE_LABEL: Record<Confidence, string> = { confirmed: "근거 확인", weak: "근거 약함", estimate: "추정" };
export const CONFIDENCE_RANK: Record<Confidence, number> = { confirmed: 2, weak: 1, estimate: 0 };

export type EvidenceLike = { url?: string | null; source?: string | null; who?: string | null; tier?: string | null; quote?: string | null; link_status?: string | null; fail_count?: number | null };

/** 판매처(상품 페이지 큐레이션) — 매체 등급이어도 무게 0.4까지 */
const RETAIL = /(^|\.)(sooldamhwa\.com|kihya\.com|dailyshot\.co|sullove\.co\.kr|zzann\.kr|sulmarket\.co\.kr)$/;
export const RETAIL_WEIGHT = 0.4;
export function isRetailHost(url: string | null | undefined): boolean { try { return !!url && RETAIL.test(new URL(url).hostname.replace(/^www\./, "")); } catch { return false; } }

/** 여러 사람이 쓰는 곳은 주소의 첫 칸까지가 한 출처 — blog.naver.com/{아이디} · cafe.naver.com/{카페} */
const PER_AUTHOR = /^(m\.)?(blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|brunch\.co\.kr|velog\.io|medium\.com)$/;

/** 근거 한 줄의 독립 출처 키 */
export function sourceKey(e: EvidenceLike, tier: string): string {
  const url = String(e.url ?? "").trim();
  if (url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const seg = u.pathname.split("/").filter(Boolean);
      if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return `yt:${u.searchParams.get("v") ?? seg.join("/")}`;
      if (PER_AUTHOR.test(host)) return `${host.replace(/^m\./, "")}/${(seg[0] ?? "").toLowerCase()}`;
      // 네이버 뉴스는 /article/{언론사}/{기사} — 언론사가 출처
      if (/^(m\.)?n\.news\.naver\.com$/.test(host)) { const i = seg.indexOf("article"); return `news:${i >= 0 ? seg[i + 1] : seg[1] ?? ""}`; }
      return host;
    } catch { /* 주소가 이상하면 아래 */ }
  }
  if (tier === "user") return `user:${String(e.who ?? "").trim() || String(e.source ?? "")}`;
  return `src:${String(e.source ?? "").trim() || String(e.who ?? "").trim() || "?"}`;
}

const tierOf = (e: EvidenceLike, fallback: SrcTier | undefined): SrcTier => {
  const t = String(e.tier ?? "") as SrcTier;
  return t in EVIDENCE_WEIGHT ? t : fallback ?? "profile";
};

/** 근거 목록 → 독립 출처 수 n · 강도 e(소수 둘째 자리) */
export function evidenceStats(rows: EvidenceLike[] | null | undefined, src?: SrcTier): { n: number; e: number } {
  const best = new Map<string, { w: number; expert: boolean }>();
  const byQuote = new Map<string, string>();
  for (const r of rows ?? []) {
    const tier = tierOf(r, src);
    let w = EVIDENCE_WEIGHT[tier] * evidenceFactor(r);
    // 판매처 제한은 판매 문구(매체·블로그 등급)에만 — 양조장·소믈리에 발언으로 검수된 인용은 실린 곳이 판매처여도 그대로
    if (w && !EXPERT.includes(tier) && isRetailHost(r.url)) w = Math.min(w, RETAIL_WEIGHT);
    if (!w) continue;
    let k = sourceKey(r, tier);
    // 인용문이 글자 그대로 같으면(띄어쓰기·문장부호 무시, 10자 이상) 앞의 출처와 하나로
    const q = String(r.quote ?? "").toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
    if (q.length >= 10) { const prev = byQuote.get(q); if (prev) k = prev; else byQuote.set(q, k); }
    const cur = best.get(k);
    if (!cur || w > cur.w) best.set(k, { w, expert: EXPERT.includes(tier) });
  }
  const vals = [...best.values()];
  const expert = vals.filter((v) => v.expert).reduce((a, v) => a + v.w, 0);
  const pub = vals.filter((v) => !v.expert).map((v) => v.w).sort((a, b) => b - a);
  const e = expert + pub.reduce((a, w, i) => a + (i === 0 ? w : w * PUBLIC_REPEAT), 0);
  return { n: best.size, e: Math.round(e * 100) / 100 };
}

/** 조합의 근거 강도 — 번들에 evs가 없으면(옛 데이터) 대표 근거 하나로 어림한다 */
export function strengthOf(p: Pick<Pairing, "src" | "ev" | "evn" | "evs">): { n: number; e: number } {
  if (typeof p.evs === "number") return { n: p.evn ?? (p.evs > 0 ? 1 : 0), e: p.evs };
  const w = EVIDENCE_WEIGHT[p.src ?? "profile"];
  return w && (p.ev?.url || p.ev?.source || p.ev?.who || p.src === "user") ? { n: 1, e: w } : { n: 0, e: 0 };
}

export function confidenceOf(p: Pick<Pairing, "src" | "ev" | "evn" | "evs">): Confidence {
  const { e } = strengthOf(p);
  return e >= CONFIRMED_FROM ? "confirmed" : e > 0 ? "weak" : "estimate";
}

/** 카드 한 줄 — "근거 확인 · 출처 2곳" / "근거 약함 · 출처 1곳" / "추정" */
export function confidenceText(p: Pick<Pairing, "src" | "ev" | "evn" | "evs">): string {
  const c = confidenceOf(p), { n } = strengthOf(p);
  return c === "estimate" ? CONFIDENCE_LABEL.estimate : `${CONFIDENCE_LABEL[c]} · 출처 ${n}곳`;
}
