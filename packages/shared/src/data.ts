/**
 * 데이터 접근 — 카탈로그(pairings.json) 로드, 인덱스, 파생 목록.
 * Phase 2: 서버 카탈로그를 받아 `applyDataset()`으로 갈아끼울 수 있다. 모든 파생값은 `export let` + 재계산.
 * 소비자는 값을 모듈 로드 시점에 복사하지 말고 사용 시점에 읽는다 (ES 모듈 라이브 바인딩).
 */
import raw from "../data/pairings.json";
import linkStatusRaw from "../data/link-status.json";
import type { Dataset, Drink, Food, Pairing, ProfileMeta, SrcTier, Trend } from "./types";

export const SRC_LABEL: Record<SrcTier, string> = {
  official: "양조장 공식", sommelier: "소믈리에·명인", media: "전문 매체", profile: "맛 프로필", ai: "AI 생성",
};
/** 출처 등급 순서 (높을수록 신뢰) */
export const SRC_RANK: Record<SrcTier, number> = { official: 4, sommelier: 3, media: 2, profile: 1, ai: 0 };

/** 전통주 미분류(일반주류) — 온라인 직배송 불가, 오프라인 안내는 '주류판매점' (docs/06 주류 규제 #5) */
export const NON_TRAD = new Set(["d12", "d13", "d21", "d32", "d43", "d52", "d55"]);
export const onlineSellable = (d: Drink) => !NON_TRAD.has(d.id);

const DEFAULT_PROFILE_META: ProfileMeta = {
  drink_keys: { sweet: "단맛", acid: "산미", body: "바디", fizz: "탄산", aroma: "향 강도" },
  food_keys: { fat: "기름기", spice: "매운맛", umami: "감칠맛", salt: "짠맛", sweet: "단맛", weight: "무게" },
  scale: "1~5", rule: "", band: "",
};

/* ---------- 현재 카탈로그와 파생 인덱스 (applyDataset이 전부 재계산) ---------- */
export let DATA: Dataset = raw as unknown as Dataset;
/** 카탈로그 버전 — 번들 내장은 "bundled", 서버에서 받으면 서버 version */
export let CATALOG_VERSION = "bundled";
export let CATALOG_SOURCE: "bundled" | "server" = "bundled";

export let D: Record<string, Drink> = {};
export let F: Record<string, Food> = {};
export let byDrink: Record<string, Pairing[]> = {};
export let byFood: Record<string, Pairing[]> = {};
export let PRESIDENT: { d: Drink; year: number }[] = [];
export let POPULAR: Drink[] = [];
export let POPULAR_FOODS: Food[] = [];
export let TREND_NOTE = "";
export let PROFILE_META: ProfileMeta = DEFAULT_PROFILE_META;
/** 술 종류별 개수 (홈 종류 탐색 칩) — 많은 순 */
export let CATEGORIES: { key: string; count: number }[] = [];
export let FOOD_CATEGORIES: { key: string; count: number }[] = [];
/** 양조장 목록 (술 수 순) */
export let BREWERIES: { name: string; region: string; count: number }[] = [];
let BEST: Pairing[] = [];

export const tscore = (x: { trend?: Trend }) => x.trend?.score || 0;
const byRank = <T extends { trend?: Trend }>(xs: T[]) => xs.filter((x) => x.trend?.rank).sort((a, b) => a.trend!.rank! - b.trend!.rank!);

function rebuildIndexes() {
  D = Object.fromEntries(DATA.drinks.map((x) => [x.id, x]));
  F = Object.fromEntries(DATA.foods.map((x) => [x.id, x]));
  byDrink = {}; byFood = {};
  for (const p of DATA.pairings) { (byDrink[p.d] ||= []).push(p); (byFood[p.f] ||= []).push(p); }
  PRESIDENT = DATA.drinks
    .map((d) => { const a = (d.awards || []).find((x) => x.includes("대통령상")); return a ? { d, year: parseInt(a) } : null; })
    .filter((x): x is { d: Drink; year: number } => !!x)
    .sort((a, b) => b.year - a.year);
  POPULAR = byRank(DATA.drinks).slice(0, 10);
  POPULAR_FOODS = byRank(DATA.foods).slice(0, 10);
  TREND_NOTE = (DATA.trend_meta?.note || "").replace(/<[^>]+>/g, "");
  PROFILE_META = DATA.profile_meta || DEFAULT_PROFILE_META;
  const cm = new Map<string, number>();
  for (const d of DATA.drinks) cm.set(d.category, (cm.get(d.category) || 0) + 1);
  CATEGORIES = [...cm.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  const fm = new Map<string, number>();
  for (const f of DATA.foods) fm.set(f.category, (fm.get(f.category) || 0) + 1);
  FOOD_CATEGORIES = [...fm.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  const bm = new Map<string, { region: string; count: number }>();
  for (const d of DATA.drinks) { if (!d.brewery) continue; const v = bm.get(d.brewery) || { region: d.region, count: 0 }; v.count++; bm.set(d.brewery, v); }
  BREWERIES = [...bm.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
  BEST = [...DATA.pairings].sort((a, b) => b.es - a.es).slice(0, 12);
}
rebuildIndexes();

/** 카탈로그 교체 훅 — search/docs.ts 등 다른 모듈이 자신의 인덱스를 재계산하도록 등록 */
const listeners = new Set<() => void>();
export function onDatasetChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** 서버 카탈로그로 교체. 최소 검증(배열·개수)만 하고 파생 인덱스를 전부 재계산한다 */
export function applyDataset(ds: Dataset, version: string, source: "bundled" | "server" = "server") {
  if (!ds || !Array.isArray(ds.drinks) || !Array.isArray(ds.foods) || !Array.isArray(ds.pairings)) throw new Error("dataset 형식 오류");
  if (!ds.drinks.length || !ds.foods.length || !ds.pairings.length) throw new Error("dataset 비어 있음");
  DATA = ds; CATALOG_VERSION = version; CATALOG_SOURCE = source;
  rebuildIndexes();
  for (const fn of listeners) fn();
}
/** 번들 내장 데이터로 되돌리기 (테스트·폴백) */
export function resetDataset() { applyDataset(raw as unknown as Dataset, "bundled", "bundled"); }

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

/** 관심지역의 술 (수상·인기순). 세부 지역에 술이 없으면 fb(상위 접두어)로 대체하고 label에 그 사실을 남긴다 */
export function drinksInRegion(pre: string[], n = 12, fb?: string[]): { list: Drink[]; label: string | null } {
  const by = (ps: string[]) => DATA.drinks.filter((d) => ps.some((p) => (d.region || "").startsWith(p)));
  let list = by(pre); let label: string | null = null;
  if (!list.length && fb) { list = by(fb); label = fb[0]; }
  list = list.sort((a, b) => ((b.awards || []).length - (a.awards || []).length) || tscore(b) - tscore(a)).slice(0, n);
  return { list, label };
}

/** 하루 단위로 바뀌는 '오늘의 페어링' */
export function todayPairing(now = Date.now()): Pairing {
  return BEST[Math.floor(now / 86400000) % BEST.length];
}
