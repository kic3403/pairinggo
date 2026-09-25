/**
 * DB 행 → 미니앱 Dataset 변환 (apps/web 카탈로그 API와 export 스크립트가 공유).
 * 컬럼명은 docs/04, 앱 필드명은 packages/shared/src/types.ts.
 */
import type { Dataset, Drink, DrinkKind, DrinkSpec, Food, Pairing, PairingServe, SpecPrice, SrcTier } from "./types";

const KIND_IDS: string[] = ["trad", "whisky", "sake", "wine"];
const SERVES: string[] = ["neat", "rocks", "highball", "warm", "cold"];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

/** 규격 행(drink_specs) + 가격 행(drink_prices) → 술별 DrinkSpec[] (유효 가격만, 0035). 열이 없는 옛 DB면 빈 표 */
export function specsFromRows(specs: Row[], prices: Row[]): Map<string, DrinkSpec[]> {
  const bySpec = new Map<string, SpecPrice[]>();
  for (const p of prices) {
    if (p.valid === false) continue;
    const arr = bySpec.get(String(p.spec_id)) || [];
    arr.push({ krw: Number(p.krw), type: p.price_type === "msrp" ? "msrp" : "retail", source: p.source || "", url: p.source_url ?? null, checked: String(p.checked_on).slice(0, 10) });
    bySpec.set(String(p.spec_id), arr);
  }
  const out = new Map<string, DrinkSpec[]>();
  for (const s of [...specs].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || Number(a.id) - Number(b.id))) {
    const arr = out.get(s.drink_id) || [];
    arr.push({
      id: String(s.id), ml: s.volume_ml == null ? null : Number(s.volume_ml), abv: s.abv == null ? null : Number(s.abv), vintage: s.vintage ?? null,
      pack: s.pack === "set" ? "set" : "bottle", bottles: Number(s.bottles ?? 1) || 1, note: s.note ?? null,
      prices: (bySpec.get(String(s.id)) || []).sort((a, b) => a.krw - b.krw),
    });
    out.set(s.drink_id, arr);
  }
  return out;
}

export function drinkFromRow(r: Row, specs?: DrinkSpec[]): Drink {
  const alias: string[] = r.alias || [];
  const kind = KIND_IDS.includes(r.kind) ? (r.kind as DrinkKind) : "trad";
  return {
    id: r.id, name: r.name, alias: alias[0] || r.name, category: r.category, abv: r.abv == null ? null : Number(r.abv),
    region: r.region || "", brewery: r.brewery_name || "", desc: r.description || "", flavor: r.flavor_tags || [],
    blog_anju: r.blog_anju || 0, awards: r.awards || [], generic: !!r.is_generic,
    trend: r.trend || undefined, profile: r.profile || undefined,
    buy: { url: r.buy_url ?? null, store: r.buy_store ?? null },
    offline: r.offline || undefined,
    image: r.image_url ? { url: r.image_url, credit: r.image_credit ?? null } : null,
    // 주종 확장(0035) — 옛 DB·옛 번들에는 열이 없으므로 기본값(전통주·한국)으로
    ...(kind !== "trad" ? { kind } : {}),
    ...(r.country && r.country !== "kr" ? { country: String(r.country) } : {}),
    ...(r.attrs && typeof r.attrs === "object" && Object.keys(r.attrs).length ? { attrs: r.attrs as Record<string, unknown> } : {}),
    ...(r.name_orig ? { nameOrig: String(r.name_orig) } : {}),
    ...(alias.length > 1 ? { aliases: alias } : {}),
    ...(r.created_at ? { added: new Date(r.created_at).toISOString().slice(0, 10) } : {}),
    ...(r.is_demo ? { demo: true } : {}),
    ...(specs?.length ? { specs } : {}),
  };
}
export function foodFromRow(r: Row): Food {
  return {
    id: r.id, name: r.name, category: r.category, tags: r.tags || [],
    trend: r.trend || undefined, alias: r.alias || [], profile: r.profile || undefined, new: !!r.is_new,
    image: r.image_url ? { url: r.image_url, credit: r.image_credit ?? null } : null,
  };
}
export function pairingFromRow(r: Row): Pairing {
  const ev = Array.isArray(r.evidence) && r.evidence.length ? r.evidence[0] : null;
  return {
    d: r.drink_id, f: r.food_id, es: r.expert_score, reason: r.reason || "", blog: r.blog_count || 0,
    src: (r.source_tier || "profile") as SrcTier,
    ev: ev ? { source: ev.source ?? null, url: ev.url ?? null, quote: ev.quote ?? null, who: ev.who ?? null } : undefined,
    pf: r.profile_score || undefined,
    ...(r.serve && SERVES.includes(r.serve) ? { serve: r.serve as PairingServe } : {}),
    ...(r.checked_on ? { checked: String(r.checked_on).slice(0, 10) } : {}),
  };
}
export function loadDatasetFromRows(x: { drinks: Row[]; foods: Row[]; pairings: Row[]; specs?: Row[]; prices?: Row[]; trend_meta?: Dataset["trend_meta"]; src_meta?: Dataset["src_meta"]; profile_meta?: Dataset["profile_meta"] }): Dataset {
  const specs = specsFromRows(x.specs ?? [], x.prices ?? []);
  return {
    drinks: x.drinks.map((r) => drinkFromRow(r, specs.get(r.id))), foods: x.foods.map(foodFromRow), pairings: x.pairings.map(pairingFromRow),
    trend_meta: x.trend_meta, src_meta: x.src_meta, profile_meta: x.profile_meta,
  };
}
