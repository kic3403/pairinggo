/**
 * 데이터 접근 — pairings.json 로드, 인덱스, 파생 목록.
 * (이식 원본: 새 폴더/pairinggo/src/lib/data.ts)
 */
import raw from "../data/pairings.json";
import linkStatusRaw from "../data/link-status.json";
import type { Dataset, Drink, Food, Pairing, ProfileMeta, SrcTier, Trend } from "./types";

export const DATA = raw as unknown as Dataset;

export const SRC_LABEL: Record<SrcTier, string> = {
  official: "양조장 공식", sommelier: "소믈리에·명인", media: "전문 매체", profile: "맛 프로필", ai: "AI 생성",
};
/** 출처 등급 순서 (높을수록 신뢰) */
export const SRC_RANK: Record<SrcTier, number> = { official: 4, sommelier: 3, media: 2, profile: 1, ai: 0 };

export const D: Record<string, Drink> = Object.fromEntries(DATA.drinks.map((x) => [x.id, x]));
export const F: Record<string, Food> = Object.fromEntries(DATA.foods.map((x) => [x.id, x]));
export const byDrink: Record<string, Pairing[]> = {};
export const byFood: Record<string, Pairing[]> = {};
for (const p of DATA.pairings) {
  (byDrink[p.d] ||= []).push(p);
  (byFood[p.f] ||= []).push(p);
}

/** 전통주 미분류(일반주류) — 온라인 직배송 불가, 오프라인 안내는 '주류판매점' (docs/06 주류 규제 #5) */
export const NON_TRAD = new Set(["d12", "d13", "d21", "d32", "d43", "d52", "d55"]);
export const onlineSellable = (d: Drink) => !NON_TRAD.has(d.id);

/* ---------- 표시 유틸 ---------- */
export function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, "") + "만";
  return n.toLocaleString("ko-KR");
}
export const naverMapUrl = (q: string) => "https://map.naver.com/p/search/" + encodeURIComponent(q);
export const naverShopUrl = (q: string) => "https://search.shopping.naver.com/search/all?query=" + encodeURIComponent(q);
export const shortAward = (a: string) => a.replace("우리술품평회 ", "");

/* ---------- 링크 상태 (scripts/check-links.mjs 결과) ---------- */
export type LinkState = { status: string; confirmedBad?: boolean; finalUrl?: string | null; checkedAt?: string };
export const LINK_STATUS = linkStatusRaw as { checkedAt: string | null; total?: number; links: Record<string, LinkState> };
export const linkState = (url?: string | null): LinkState | undefined => (url ? LINK_STATUS.links[url] : undefined);
/** 구매 링크: 2회 연속 불량(404·품절)으로 확인된 링크는 네이버쇼핑으로 폴백 */
export function buyLink(d: Drink): { url: string; store: string; fallback: boolean; soldout: boolean } {
  const st = linkState(d.buy.url);
  if (d.buy.url && !st?.confirmedBad) return { url: d.buy.url, store: d.buy.store || "구매 페이지", fallback: false, soldout: st?.status === "soldout" };
  return { url: naverShopUrl(d.name), store: "네이버쇼핑", fallback: !!d.buy.url, soldout: false };
}

/* ---------- 파생 목록 ---------- */
export const PRESIDENT = DATA.drinks
  .map((d) => { const a = (d.awards || []).find((x) => x.includes("대통령상")); return a ? { d, year: parseInt(a) } : null; })
  .filter((x): x is { d: Drink; year: number } => !!x)
  .sort((a, b) => b.year - a.year);

export const tscore = (x: { trend?: Trend }) => x.trend?.score || 0;
const byRank = <T extends { trend?: Trend }>(xs: T[]) => xs.filter((x) => x.trend?.rank).sort((a, b) => a.trend!.rank! - b.trend!.rank!);
export const POPULAR = byRank(DATA.drinks).slice(0, 10);
export const POPULAR_FOODS = byRank(DATA.foods).slice(0, 10);
export const TREND_NOTE = (DATA.trend_meta?.note || "").replace(/<[^>]+>/g, "");
export const PROFILE_META: ProfileMeta = DATA.profile_meta || {
  drink_keys: { sweet: "단맛", acid: "산미", body: "바디", fizz: "탄산", aroma: "향 강도" },
  food_keys: { fat: "기름기", spice: "매운맛", umami: "감칠맛", salt: "짠맛", sweet: "단맛", weight: "무게" },
  scale: "1~5", rule: "", band: "",
};

/** 술 종류별 개수 (홈 종류 탐색 칩) — 데이터 등장 순 유지 */
export const CATEGORIES: { key: string; count: number }[] = (() => {
  const m = new Map<string, number>();
  for (const d of DATA.drinks) m.set(d.category, (m.get(d.category) || 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
})();
export const FOOD_CATEGORIES: { key: string; count: number }[] = (() => {
  const m = new Map<string, number>();
  for (const f of DATA.foods) m.set(f.category, (m.get(f.category) || 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
})();
/** 양조장 목록 (술 수 순) */
export const BREWERIES: { name: string; region: string; count: number }[] = (() => {
  const m = new Map<string, { region: string; count: number }>();
  for (const d of DATA.drinks) { if (!d.brewery) continue; const v = m.get(d.brewery) || { region: d.region, count: 0 }; v.count++; m.set(d.brewery, v); }
  return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
})();

/** 관심지역의 술 (수상·인기순). 세부 지역에 술이 없으면 fb(상위 접두어)로 대체하고 label에 그 사실을 남긴다 */
export function drinksInRegion(pre: string[], n = 12, fb?: string[]): { list: Drink[]; label: string | null } {
  const by = (ps: string[]) => DATA.drinks.filter((d) => ps.some((p) => (d.region || "").startsWith(p)));
  let list = by(pre); let label: string | null = null;
  if (!list.length && fb) { list = by(fb); label = fb[0]; }
  list = list.sort((a, b) => ((b.awards || []).length - (a.awards || []).length) || tscore(b) - tscore(a)).slice(0, n);
  return { list, label };
}

/** 하루 단위로 바뀌는 '오늘의 페어링' */
const BEST = [...DATA.pairings].sort((a, b) => b.es - a.es).slice(0, 12);
export function todayPairing(now = Date.now()): Pairing {
  return BEST[Math.floor(now / 86400000) % BEST.length];
}
