/**
 * 검색 유입용 모음 화면(2026-10-01) — "막걸리 안주 추천"·"전에 어울리는 술"처럼 종류 단위로 찾는 검색어에 맞춘 `/guide/[slug]`.
 * 술·음식 상세는 이름 검색을 받고, 여기는 종류 검색을 받는다. 내용은 **근거(확인·약함)가 있는 조합만** 모아 센다 — 추정 조합은 넣지 않는다.
 * 근거 조합이 GUIDE_MIN개 미만인 종류는 화면을 만들지 않는다(얇은 화면은 검색엔진에도 손님에게도 도움이 안 된다).
 *
 * 묶는 기준(by) 네 가지(2026-10-02 지역·맛 추가):
 *  · 술 쪽 — category(술 종류: 막걸리 안주) · region(지역: 충남 전통주 안주 — 술 region의 첫 낱말)
 *  · 음식 쪽 — category(음식 종류: 전과 어울리는 술) · tag(맛: 매운 음식에 어울리는 술 — 음식 tags, TASTE_GUIDE_WORD에 있는 것만)
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

/** 맛 모음 — 음식 태그 → 제목에 쓸 말과 주소. 여기 있는 태그만 화면을 만든다(태그가 수십 가지라 검색할 만한 말만 고른다) */
export const TASTE_GUIDE_WORD: Record<string, { word: string; slug: string }> = {
  매콤: { word: "매운 음식", slug: "매운음식" },
  기름진: { word: "기름진 음식", slug: "기름진음식" },
  담백: { word: "담백한 음식", slug: "담백한음식" },
  달콤: { word: "달콤한 음식", slug: "달콤한음식" },
  고소: { word: "고소한 음식", slug: "고소한음식" },
  감칠맛: { word: "감칠맛 나는 음식", slug: "감칠맛음식" },
};

export type GuideBy = "category" | "region" | "tag";
export type GuideDef = {
  slug: string; side: "drink" | "food";
  /** 묶는 기준 — 종류·지역(술)·맛(음식) */
  by: GuideBy;
  /** 기준 값 — 술·음식 category, 지역 이름("충남"), 음식 태그("매콤") */
  category: string;
  /** 사람이 읽는 묶음 이름 — "막걸리"·"충남 전통주"·"전"·"매운 음식" */
  word: string;
  /** 화면 제목(h1)과 검색 결과 제목·설명 */
  h1: string; title: string; description: string;
  /** 근거 조합 수 */
  n: number;
};

const drinkWord = (category: string) => DRINK_GUIDE_WORD[category] ?? { word: category, slug: category.replace(/[^0-9A-Za-z가-힣]/g, "") };
const clean = (s: string) => s.replace(/[^0-9A-Za-z가-힣]/g, "");
/** 술의 지역 — region의 첫 낱말("충남 서천" → "충남") */
export const guideRegionOf = (d: Pick<Drink, "region">) => (d.region || "").trim().split(/\s+/)[0] || "";

type Row = { p: Pairing; d: Drink; f: Food; conf: Conf; e: number };
function evidencePairs(ds: DS): Row[] {
  const D = new Map(ds.drinks.map((d) => [d.id, d])), F = new Map(ds.foods.map((f) => [f.id, f]));
  const rows: Row[] = [];
  for (const p of ds.pairings) {
    const conf = confidenceOf(p);
    if (conf === "estimate") continue;
    const d = D.get(p.d), f = F.get(p.f);
    if (d && f) rows.push({ p, d, f, conf, e: strengthOf(p).e });
  }
  return rows;
}

const inGuide = (def: Pick<GuideDef, "side" | "by" | "category">, r: Row) =>
  def.side === "drink"
    ? (def.by === "region" ? guideRegionOf(r.d) === def.category : r.d.category === def.category)
    : (def.by === "tag" ? (r.f.tags ?? []).includes(def.category) : r.f.category === def.category);

const add = (m: Map<string, number>, k: string) => { if (k) m.set(k, (m.get(k) ?? 0) + 1); };
const BY_ORDER: Record<string, number> = { "drink|category": 0, "drink|region": 1, "food|category": 2, "food|tag": 3 };

/** 만들 수 있는 모음 화면 전부 — 술 종류 → 지역 → 음식 종류 → 맛 차례, 그 안에서는 근거 조합이 많은 순 */
export function guideList(ds: DS): GuideDef[] {
  const dn = new Map<string, number>(), rn = new Map<string, number>(), fn = new Map<string, number>(), tn = new Map<string, number>();
  for (const r of evidencePairs(ds)) {
    add(dn, r.d.category); add(rn, guideRegionOf(r.d)); add(fn, r.f.category);
    for (const t of new Set(r.f.tags ?? [])) if (TASTE_GUIDE_WORD[t]) add(tn, t);
  }
  const out: GuideDef[] = [];
  for (const [category, n] of dn) {
    if (n < GUIDE_MIN) continue;
    const w = drinkWord(category);
    out.push({
      slug: `${w.slug}-안주`, side: "drink", by: "category", category, word: w.word, n,
      h1: `${w.word} 안주 추천`,
      title: `${w.word} 안주 추천 — 근거로 고른 ${w.word}에 어울리는 음식`,
      description: `${josa(w.word, "과/와")} 어울리는 안주를 양조장·소믈리에·매체가 확인한 조합 ${n}개에서 골랐습니다. 음식마다 어울리는 ${w.word} 이름과 근거를 함께 봅니다.`,
    });
  }
  for (const [region, n] of rn) {
    if (n < GUIDE_MIN) continue;
    const word = `${region} 전통주`;
    out.push({
      slug: `${clean(region)}-전통주-안주`, side: "drink", by: "region", category: region, word, n,
      h1: `${word} 안주 추천`,
      title: `${word} 안주 추천 — ${region}에서 빚은 술에 어울리는 음식`,
      description: `${region} 양조장의 전통주와 어울리는 안주를 양조장·소믈리에·매체가 확인한 조합 ${n}개에서 골랐습니다. 음식마다 어울리는 ${region} 술 이름과 근거를 함께 봅니다.`,
    });
  }
  for (const [category, n] of fn) {
    if (n < GUIDE_MIN) continue;
    const word = FOOD_GUIDE_WORD[category] ?? category;   // 주소는 종류 이름 그대로, 제목만 읽기 좋게
    out.push({
      slug: `${clean(category)}-어울리는-술`, side: "food", by: "category", category, word, n,
      h1: `${josa(word, "과/와")} 어울리는 술`,
      title: `${josa(word, "과/와")} 어울리는 술 추천 — 근거로 고른 전통주`,
      description: `${word}에 어울리는 전통주를 양조장·소믈리에·매체가 확인한 조합 ${n}개에서 골랐습니다. 술마다 어울리는 ${category} 메뉴와 근거를 함께 봅니다.`,
    });
  }
  for (const [tag, n] of tn) {
    if (n < GUIDE_MIN) continue;
    const w = TASTE_GUIDE_WORD[tag];
    out.push({
      slug: `${w.slug}-어울리는-술`, side: "food", by: "tag", category: tag, word: w.word, n,
      h1: `${w.word}에 어울리는 술`,
      title: `${w.word}에 어울리는 술 추천 — 근거로 고른 전통주`,
      description: `${w.word}에 어울리는 전통주를 양조장·소믈리에·매체가 확인한 조합 ${n}개에서 골랐습니다. 술마다 어울리는 ${josa(w.word, "과/와")} 근거를 함께 봅니다.`,
    });
  }
  return out.sort((a, b) => BY_ORDER[`${a.side}|${a.by}`] - BY_ORDER[`${b.side}|${b.by}`] || b.n - a.n || a.slug.localeCompare(b.slug, "ko"));
}

const key = (s: string) => {
  let v = s || "";
  try { v = decodeURIComponent(v); } catch { /* 이미 디코드된 값 */ }
  return v.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
};
export const findGuide = (ds: DS, slug: string): GuideDef | undefined => guideList(ds).find((g) => key(g.slug) === key(slug));

/** 짝 한 줄 — 근거 표시와 출처 갈래(양조장 추천·매체 소개…), 우리가 쓴 설명(reason). 블로그 글 초안이 쓴다 */
export type GuideWith<B> = { item: B; conf: Conf; src: string; reason: string };
export type GuideRow<A, B> = { item: A; score: number; n: number; confirmed: number; with: GuideWith<B>[] };
export type GuideContent = {
  def: GuideDef;
  /** 술 쪽 화면: 어울리는 음식 순위(음식마다 그 묶음의 술 3개) */
  foods: GuideRow<Food, Drink>[];
  /** 음식 쪽 화면: 어울리는 술 순위(술마다 그 묶음의 음식 3개) */
  drinks: GuideRow<Drink, Food>[];
  /** 음식 쪽 화면: 술 종류별 근거 조합 수(많은 순) · 술 쪽 화면: 음식 종류별 */
  mix: { name: string; n: number }[];
};

/** 출처 갈래를 글에 쓰는 말로 — 화면의 출처 이름(SRC_LABEL)보다 짧게 */
const SRC_WORD: Record<string, string> = { official: "양조장 추천", sommelier: "소믈리에 추천", media: "매체 소개", blog: "블로그 후기", user: "회원 추천" };

function rank<A extends { id: string; name: string }, B extends { id: string }>(rows: { a: A; b: B; r: Row }[], top: number, per: number): GuideRow<A, B>[] {
  const m = new Map<string, { item: A; score: number; n: number; confirmed: number; list: { item: B; r: Row }[] }>();
  for (const x of rows) {
    const cur = m.get(x.a.id) ?? { item: x.a, score: 0, n: 0, confirmed: 0, list: [] };
    cur.n++; cur.score += x.r.conf === "confirmed" ? 2 : 1; if (x.r.conf === "confirmed") cur.confirmed++;
    cur.list.push({ item: x.b, r: x.r });
    m.set(x.a.id, cur);
  }
  return [...m.values()]
    .sort((x, y) => y.score - x.score || y.n - x.n || x.item.name.localeCompare(y.item.name, "ko"))
    .slice(0, top)
    .map((x) => ({
      item: x.item, score: x.score, n: x.n, confirmed: x.confirmed,
      with: x.list.sort((p, q) => (q.r.conf === "confirmed" ? 1 : 0) - (p.r.conf === "confirmed" ? 1 : 0) || q.r.e - p.r.e).slice(0, per)
        .map(({ item, r }) => ({ item, conf: r.conf, src: SRC_WORD[r.p.src ?? ""] ?? "", reason: r.p.reason ?? "" })),
    }));
}

/** 화면 내용 — 근거 조합만. top = 순위 길이, per = 줄마다 붙이는 짝 수 */
export function guideContent(ds: DS, def: GuideDef, top = 15, per = 3): GuideContent {
  const rows = evidencePairs(ds).filter((r) => inGuide(def, r));
  const mixOf = (name: (r: Row) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) add(m, name(r));
    return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "ko"));
  };
  return {
    def,
    foods: rank(rows.map((r) => ({ a: r.f, b: r.d, r })), top, per),
    drinks: rank(rows.map((r) => ({ a: r.d, b: r.f, r })), top, per),
    mix: def.side === "drink" ? mixOf((r) => r.f.category) : mixOf((r) => r.d.category),
  };
}
