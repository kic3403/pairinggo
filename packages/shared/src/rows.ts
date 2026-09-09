/**
 * DB 행 → 미니앱 Dataset 변환 (apps/web 카탈로그 API와 export 스크립트가 공유).
 * 컬럼명은 docs/04, 앱 필드명은 packages/shared/src/types.ts.
 */
import type { Dataset, Drink, Food, Pairing, SrcTier } from "@pairinggo/shared";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function drinkFromRow(r: Row): Drink {
  const alias: string[] = r.alias || [];
  return {
    id: r.id, name: r.name, alias: alias[0] || r.name, category: r.category, abv: r.abv == null ? null : Number(r.abv),
    region: r.region || "", brewery: r.brewery_name || "", desc: r.description || "", flavor: r.flavor_tags || [],
    blog_anju: r.blog_anju || 0, awards: r.awards || [], generic: !!r.is_generic,
    trend: r.trend || undefined, profile: r.profile || undefined,
    buy: { url: r.buy_url ?? null, store: r.buy_store ?? null },
    offline: r.offline || undefined,
  };
}
export function foodFromRow(r: Row): Food {
  return {
    id: r.id, name: r.name, category: r.category, tags: r.tags || [],
    trend: r.trend || undefined, alias: r.alias || [], profile: r.profile || undefined, new: !!r.is_new,
  };
}
export function pairingFromRow(r: Row): Pairing {
  const ev = Array.isArray(r.evidence) && r.evidence.length ? r.evidence[0] : null;
  return {
    d: r.drink_id, f: r.food_id, es: r.expert_score, reason: r.reason || "", blog: r.blog_count || 0,
    src: (r.source_tier || "profile") as SrcTier,
    ev: ev ? { source: ev.source ?? null, url: ev.url ?? null, quote: ev.quote ?? null, who: ev.who ?? null } : undefined,
    pf: r.profile_score || undefined,
  };
}
export function loadDatasetFromRows(x: { drinks: Row[]; foods: Row[]; pairings: Row[]; trend_meta?: Dataset["trend_meta"]; src_meta?: Dataset["src_meta"]; profile_meta?: Dataset["profile_meta"] }): Dataset {
  return {
    drinks: x.drinks.map(drinkFromRow), foods: x.foods.map(foodFromRow), pairings: x.pairings.map(pairingFromRow),
    trend_meta: x.trend_meta, src_meta: x.src_meta, profile_meta: x.profile_meta,
  };
}
