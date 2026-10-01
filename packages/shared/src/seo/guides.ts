/**
 * 검색 유입용 모음 화면(2026-10-01) — "막걸리 안주 추천"·"전에 어울리는 술"처럼 종류 단위로 찾는 검색어에 맞춘 `/guide/[slug]`.
 * 술·음식 상세는 이름 검색을 받고, 여기는 종류 검색을 받는다. 내용은 **근거(확인·약함)가 있는 조합만** 모아 센다 — 추정 조합은 넣지 않는다.
 * 근거 조합이 GUIDE_MIN개 미만인 종류는 화면을 만들지 않는다(얇은 화면은 검색엔진에도 손님에게도 도움이 안 된다).
 */
import type { Drink, Food, Pairing } from "../types";
import { josa } from "../hangul";
import { confidenceOf, strengthOf, type Confidence } from "../pairing/confidence";

type DS = { drinks: readonly Drink[]; foods: readonly Food[]; pairings: readonly Pairing[] };
type Conf = Exclude<Confidence, "estimate">;

export const GUIDE_MIN = 10;

/** 술 종류(DB 식별자) → 사람들이 검색하는 말. 없는 종류는 식별자 그대로 */
export const DRINK_GUIDE_WORD: Record<string, { word: string; slug: string; note?: string }> = {
  탁주: { word: "막걸리", slug: "막걸리", note: "탁주" },
  약주: { word: "약주", slug: "약주" },
  증류주: { word: "전통 소주", slug: "전통소주", note: "증류주" },
  과실주: { word: "과실주", slug: "과실주", note: "한국 와인" },
  리큐르: { word: "리큐르", slug: "리큐르" },
  허니와인: { word: "허니와인", slug: "허니와인", note: "미드" },
  청주: { word: "청주", slug: "청주" },
};

/** 음식 종류 이름이 제목에서 어색한 것만 바꿔 읽는다 — "안주와 어울리는 술"은 말이 겹친다 */
export const FOOD_GUIDE_WORD: Record<string, string> = { 안주: "안주류" };

export type GuideDef = {
  slug: string; side: "drink" | "food";
  /** 카탈로그 종류(술 category 또는 음식 category) */
  category: string;
  /** 화면 제목(h1)과 검색 결과 제목·설명 */
  h1: string; title: string; description: string;
  /** 근거 조합 수 */
  n: number;
};

const drinkWord = (category: string) => DRINK_GUIDE_WORD[category] ?? { word: category, slug: category.replace(/[^0-9A-Za-z가-힣]/g, "") };

function evidencePairs(ds: DS) {
  const D = new Map(ds.drinks.map((d) => [d.id, d])), F = new Map(ds.foods.map((f) => [f.id, f]));
  const rows: { p: Pairing; d: Drink; f: Food; conf: Conf; e: number }[] = [];
  for (const p of ds.pairings) {
    const conf = confidenceOf(p);
    if (conf === "estimate") continue;
    const d = D.get(p.d), f = F.get(p.f);
    if (d && f) rows.push({ p, d, f, conf, e: strengthOf(p).e });
  }
  return rows;
}

/** 만들 수 있는 모음 화면 전부 — 근거 조합이 많은 순 */
export function guideList(ds: DS): GuideDef[] {
  const dn = new Map<string, number>(), fn = new Map<string, number>();
  for (const r of evidencePairs(ds)) { dn.set(r.d.category, (dn.get(r.d.category) ?? 0) + 1); fn.set(r.f.category, (fn.get(r.f.category) ?? 0) + 1); }
  const out: GuideDef[] = [];
  for (const [category, n] of dn) {
    if (n < GUIDE_MIN || !category) continue;
    const w = drinkWord(category);
    out.push({
      slug: `${w.slug}-안주`, side: "drink", category, n,
      h1: `${w.word} 안주 추천`,
      title: `${w.word} 안주 추천 — 근거로 고른 ${w.word}에 어울리는 음식`,
      description: `${josa(w.word, "과/와")} 어울리는 안주를 양조장·소믈리에·매체가 확인한 조합 ${n}개에서 골랐습니다. 음식마다 어울리는 ${w.word} 이름과 근거를 함께 봅니다.`,
    });
  }
  for (const [category, n] of fn) {
    if (n < GUIDE_MIN || !category) continue;
    const word = FOOD_GUIDE_WORD[category] ?? category;   // 주소는 종류 이름 그대로, 제목만 읽기 좋게
    out.push({
      slug: `${category.replace(/[^0-9A-Za-z가-힣]/g, "")}-어울리는-술`, side: "food", category, n,
      h1: `${josa(word, "과/와")} 어울리는 술`,
      title: `${josa(word, "과/와")} 어울리는 술 추천 — 근거로 고른 전통주`,
      description: `${word}에 어울리는 전통주를 양조장·소믈리에·매체가 확인한 조합 ${n}개에서 골랐습니다. 술마다 어울리는 ${category} 메뉴와 근거를 함께 봅니다.`,
    });
  }
  return out.sort((a, b) => (a.side === b.side ? b.n - a.n : a.side === "drink" ? -1 : 1));
}

const key = (s: string) => {
  let v = s || "";
  try { v = decodeURIComponent(v); } catch { /* 이미 디코드된 값 */ }
  return v.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
};
export const findGuide = (ds: DS, slug: string): GuideDef | undefined => guideList(ds).find((g) => key(g.slug) === key(slug));

export type GuideRow<A, B> = { item: A; score: number; n: number; confirmed: number; with: { item: B; conf: Conf }[] };
export type GuideContent = {
  def: GuideDef;
  /** 술 종류 화면: 어울리는 음식 순위(음식마다 그 종류 술 3개) */
  foods: GuideRow<Food, Drink>[];
  /** 음식 종류 화면: 어울리는 술 순위(술마다 그 종류 음식 3개) */
  drinks: GuideRow<Drink, Food>[];
  /** 음식 종류 화면: 술 종류별 근거 조합 수(많은 순) · 술 종류 화면: 음식 종류별 */
  mix: { name: string; n: number }[];
};

function rank<A extends { id: string; name: string }, B extends { id: string }>(rows: { a: A; b: B; conf: Conf; e: number }[], top: number, per: number): GuideRow<A, B>[] {
  const m = new Map<string, { item: A; score: number; n: number; confirmed: number; list: { item: B; conf: Conf; e: number }[] }>();
  for (const r of rows) {
    const cur = m.get(r.a.id) ?? { item: r.a, score: 0, n: 0, confirmed: 0, list: [] };
    cur.n++; cur.score += r.conf === "confirmed" ? 2 : 1; if (r.conf === "confirmed") cur.confirmed++;
    cur.list.push({ item: r.b, conf: r.conf, e: r.e });
    m.set(r.a.id, cur);
  }
  return [...m.values()]
    .sort((x, y) => y.score - x.score || y.n - x.n || x.item.name.localeCompare(y.item.name, "ko"))
    .slice(0, top)
    .map((x) => ({ item: x.item, score: x.score, n: x.n, confirmed: x.confirmed, with: x.list.sort((p, q) => (q.conf === "confirmed" ? 1 : 0) - (p.conf === "confirmed" ? 1 : 0) || q.e - p.e).slice(0, per).map(({ item, conf }) => ({ item, conf })) }));
}

/** 화면 내용 — 근거 조합만. top = 순위 길이, per = 줄마다 붙이는 짝 수 */
export function guideContent(ds: DS, def: GuideDef, top = 15, per = 3): GuideContent {
  const rows = evidencePairs(ds).filter((r) => (def.side === "drink" ? r.d.category : r.f.category) === def.category);
  const mixOf = (name: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(name(r), (m.get(name(r)) ?? 0) + 1);
    return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "ko"));
  };
  return {
    def,
    foods: rank(rows.map((r) => ({ a: r.f, b: r.d, conf: r.conf, e: r.e })), top, per),
    drinks: rank(rows.map((r) => ({ a: r.d, b: r.f, conf: r.conf, e: r.e })), top, per),
    mix: def.side === "drink" ? mixOf((r) => r.f.category) : mixOf((r) => r.d.category),
  };
}
