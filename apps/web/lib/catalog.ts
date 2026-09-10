/**
 * 카탈로그 — DB(Supabase)에서 Dataset을 조립하고 5분 캐시. DB 미설정·실패 시 shared 번들 데이터로 폴백.
 * 서버 프로세스의 shared 인덱스(검색 엔진)도 같은 버전으로 맞춘다(applyDataset).
 */
import { DATA as BUNDLED, CATALOG_VERSION, applyDataset, loadDatasetFromRows, type Dataset } from "@pairinggo/shared";
import { db } from "./db";

export type Catalog = { version: string; source: "db" | "static"; dataset: Dataset; counts: { drinks: number; foods: number; pairings: number } };

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: Catalog } | null = null;
let inflight: Promise<Catalog> | null = null;

const counts = (ds: Dataset) => ({ drinks: ds.drinks.length, foods: ds.foods.length, pairings: ds.pairings.length });
/** 정적 모드 버전 — 내용 해시. 미니앱의 "bundled"와 달라야 핫스왑 경로가 동작하고, 데이터가 같으면 값도 같다 */
const STATIC_VERSION = (() => {
  const s = JSON.stringify(BUNDLED); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `static-${h.toString(16).padStart(8, "0")}`;
})();
const staticCatalog = (): Catalog => ({ version: STATIC_VERSION, source: "static", dataset: BUNDLED, counts: counts(BUNDLED) });

async function fromDb(): Promise<Catalog | null> {
  const sb = db();
  if (!sb) return null;
  const [meta, drinks, foods, pairings, evidence] = await Promise.all([
    sb.from("catalog_meta").select("key,value").in("key", ["version"]),
    sb.from("drinks").select("*").order("id"),
    sb.from("foods").select("*").order("id"),
    sb.from("pairings").select("*").in("status", ["curated", "ai"]).order("id"),   // pending(검수 중)·hidden 제외
    sb.from("pairing_evidence").select("pairing_id,source,url,quote,who,tier").order("id"),
  ]);
  for (const r of [meta, drinks, foods, pairings, evidence]) if (r.error) throw new Error(r.error.message);
  if (!drinks.data?.length || !foods.data?.length || !pairings.data?.length) return null;
  const evByPairing = new Map<number, unknown[]>();
  for (const e of evidence.data || []) { const arr = evByPairing.get(e.pairing_id) || []; arr.push(e); evByPairing.set(e.pairing_id, arr); }
  const rows = pairings.data.map((p) => ({ ...p, evidence: evByPairing.get(p.id) || [] }));
  const dataset = loadDatasetFromRows({ drinks: drinks.data, foods: foods.data, pairings: rows, trend_meta: BUNDLED.trend_meta, src_meta: BUNDLED.src_meta, profile_meta: BUNDLED.profile_meta });
  const version = String(meta.data?.find((m) => m.key === "version")?.value ?? "db");
  return { version, source: "db", dataset, counts: counts(dataset) };
}

export async function getCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  if (inflight) return inflight;
  inflight = (async () => {
    let value: Catalog;
    try { value = (await fromDb()) ?? staticCatalog(); }
    catch (e) { console.error("[catalog] DB 조회 실패, 정적 폴백:", (e as Error).message); value = staticCatalog(); }
    // 서버 검색 엔진도 같은 카탈로그를 보게 한다
    if (value.source === "db" && value.version !== CATALOG_VERSION) {
      try { applyDataset(value.dataset, value.version, "server"); } catch (e) { console.error("[catalog] applyDataset 실패:", (e as Error).message); }
    }
    cache = { at: Date.now(), value };
    return value;
  })();
  try { return await inflight; } finally { inflight = null; }
}

export function invalidateCatalog() { cache = null; }
