/**
 * 파트너(양조장·식당) 추천 페어링 — 공개 화면용(2026-09-29). 원본은 partner_pairings(packages/server/partner-pairings.ts), 여기는 읽기·고르기.
 *  · 카탈로그에 연결된 조합은 이미 페어링 카드(근거 "○○ 제공/추천")로 보이므로 술·음식 화면에서는 뺀다(한 화면에 같은 것 두 번 X)
 *  · 검색·음식 화면은 비슷한 음식이면 찾는다(shared foodSimilarity: 같은 음식 → 글자 포함 → 같은 분류)
 *  · 10분 캐시 + 카탈로그 버전이 바뀌면 다시(파트너가 저장하면 버전을 올린다)
 */
import { FOOD_MATCH_RANK, foodCategoryOf, foodSimilarity, normFoodText, resolveDrinkText, resolveFoodText, toSlug, type FoodMatch } from "@pairinggo/shared";
import { publicPartnerPairings, type PublicPartnerPairing } from "@pairinggo/server/partner-pairings";
import { getCatalog } from "./catalog";

export type PartnerRec = PublicPartnerPairing & {
  drinkName: string | null; drinkHref: string | null; foodName: string | null; foodHref: string | null; placeHref: string;
  foodCategory: string | null; inCatalog: boolean; match?: FoodMatch;
};

const TTL = 10 * 60 * 1000;
let cache: { at: number; version: string; recs: PartnerRec[] } | null = null;

export async function partnerRecs(): Promise<PartnerRec[]> {
  const c = await getCatalog();
  if (cache && cache.version === c.version && Date.now() - cache.at < TTL) return cache.recs;
  const D = new Map(c.dataset.drinks.map((d) => [d.id, d])), F = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const pairs = new Set(c.dataset.pairings.map((p) => `${p.d}|${p.f}`));
  const foods = c.dataset.foods.map((f) => ({ id: f.id, name: f.name, alias: f.alias ?? [], category: f.category }));
  let raw: PublicPartnerPairing[] = [];
  try { raw = await publicPartnerPairings(); } catch (e) { console.warn("[partner-recs]", (e as Error).message); }
  const recs = raw.map((r): PartnerRec => {
    const d = r.drinkId ? D.get(r.drinkId) : undefined, f = r.foodId ? F.get(r.foodId) : undefined;
    return {
      ...r,
      drinkName: d?.name ?? null, drinkHref: d ? `/drinks/${toSlug(d.name)}` : null,
      foodName: f?.name ?? null, foodHref: f ? `/foods/${toSlug(f.name)}${d ? `?d=${d.id}` : ""}` : null,
      placeHref: `/places/${encodeURIComponent(r.kakaoId)}?n=${encodeURIComponent(r.merchantName)}`,
      foodCategory: f?.category ?? foodCategoryOf(r.foodText, foods),
      inCatalog: !!(r.drinkId && r.foodId && r.linked && pairs.has(`${r.drinkId}|${r.foodId}`)),
    };
  });
  cache = { at: Date.now(), version: c.version, recs };
  return recs;
}

const byMatch = (a: PartnerRec, b: PartnerRec) => FOOD_MATCH_RANK[a.match ?? "similar"] - FOOD_MATCH_RANK[b.match ?? "similar"] || a.merchantName.localeCompare(b.merchantName, "ko");

/** 검색어 — 음식으로 비슷하면(같은 음식·글자·분류) + 술 이름이 맞으면 */
export async function recsForQuery(q: string, limit = 8): Promise<PartnerRec[]> {
  const text = String(q ?? "").trim();
  if (normFoodText(text).length < 1) return [];
  const all = await partnerRecs();
  if (!all.length) return [];
  const c = await getCatalog();
  const foods = c.dataset.foods.map((f) => ({ id: f.id, name: f.name, alias: f.alias ?? [], category: f.category }));
  const qFood = resolveFoodText(text, foods);
  const qRef = { text, id: qFood?.id ?? null, category: foodCategoryOf(text, foods) };
  const qDrink = resolveDrinkText(text, c.dataset.drinks.map((d) => ({ id: d.id, name: d.name })));
  const qn = normFoodText(text);
  const out: PartnerRec[] = [];
  for (const r of all) {
    const drinkHit = (qDrink && r.drinkId === qDrink.id) || (qn.length >= 2 && normFoodText(r.drinkText).includes(qn));
    const m = foodSimilarity(qRef, { text: r.foodText, id: r.foodId, category: r.foodCategory });
    if (drinkHit) out.push({ ...r, match: "exact" });
    else if (m) out.push({ ...r, match: m });
  }
  return out.sort(byMatch).slice(0, limit);
}

/** 술 화면 — 이 술 추천 중 카드로 이미 보이지 않는 것(카탈로그에 없는 음식 등) */
export async function recsForDrink(drinkId: string): Promise<PartnerRec[]> {
  return (await partnerRecs()).filter((r) => r.drinkId === drinkId && !r.inCatalog);
}

/** 음식 화면 — 같은 음식이지만 카드에 없는 것 + 비슷한 음식 추천 */
export async function recsForFood(food: { id: string; name: string; category: string }, limit = 8): Promise<PartnerRec[]> {
  const out: PartnerRec[] = [];
  for (const r of await partnerRecs()) {
    if (r.inCatalog && r.foodId === food.id) continue;
    const m = foodSimilarity({ text: food.name, id: food.id, category: food.category }, { text: r.foodText, id: r.foodId, category: r.foodCategory });
    if (m) out.push({ ...r, match: m });
  }
  return out.sort(byMatch).slice(0, limit);
}

/** 매장 화면 — 그 매장 추천 전부 */
export async function recsForPlace(kakaoId: string): Promise<PartnerRec[]> {
  return (await partnerRecs()).filter((r) => r.kakaoId === kakaoId);
}
