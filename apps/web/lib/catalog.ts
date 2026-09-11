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

/**
 * PostgREST(Supabase)는 한 번의 select로 최대 PAGE행만 돌려주고, 초과분은 **오류가 아니라 HTTP 206**으로 조용히 자른다.
 * (실측 2026-09-11: pairing_candidates 11,730행 요청 → 1,000행 + 206) 그래서 끝까지 페이지로 받아온다.
 */
const PAGE = 1000;
const MAX_ROWS = 100_000; // 폭주 방지 상한 — 여기에 걸리면 데이터가 잘린 것이므로 크게 경고한다
type Page<T> = { data: T[] | null; error: { message: string } | null };

async function selectAll<T>(label: string, page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const out: T[] = [];
  for (;;) {
    const { data, error } = await page(out.length, out.length + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;                  // 마지막 페이지
    if (out.length >= MAX_ROWS) { console.error(`[catalog] ${label} ${MAX_ROWS}행 상한 도달 — 데이터가 잘렸습니다`); return out; }
  }
}

type Row = Record<string, unknown>;
type EvidenceRow = { pairing_id: number } & Row;

async function fromDb(): Promise<Catalog | null> {
  const sb = db();
  if (!sb) return null;
  const [meta, drinks, foods, pairings, evidence] = await Promise.all([
    sb.from("catalog_meta").select("key,value").in("key", ["version", "trend_meta"]),
    selectAll<Row>("drinks", (f, t) => sb.from("drinks").select("*").order("id").range(f, t)),
    selectAll<Row>("foods", (f, t) => sb.from("foods").select("*").order("id").range(f, t)),
    // pending(검수 중)·hidden 제외
    selectAll<Row>("pairings", (f, t) => sb.from("pairings").select("*").in("status", ["curated", "ai"]).order("id").range(f, t)),
    // TODO: 페어링당 첫 근거만 쓰는데 전체를 받아온다 — 뷰(distinct on pairing_id)를 만들면 전송량이 줄어든다
    selectAll<EvidenceRow>("pairing_evidence", (f, t) => sb.from("pairing_evidence").select("pairing_id,source,url,quote,who,tier").order("id").range(f, t)),
  ]);
  if (meta.error) throw new Error(meta.error.message);
  if (!drinks.length || !foods.length || !pairings.length) return null;
  const evByPairing = new Map<number, unknown[]>();
  for (const e of evidence) { const arr = evByPairing.get(e.pairing_id) || []; arr.push(e); evByPairing.set(e.pairing_id, arr); }
  const rows = pairings.map((p) => ({ ...p, evidence: evByPairing.get(p.id as number) || [] }));
  // 트렌드 설명(기간·채널)은 일일 크론(/api/cron/mentions)이 catalog_meta.trend_meta에 쓴다. 없으면 번들 값
  const trendMeta = (meta.data?.find((m) => m.key === "trend_meta")?.value as Dataset["trend_meta"] | undefined) ?? BUNDLED.trend_meta;
  const dataset = loadDatasetFromRows({ drinks, foods, pairings: rows, trend_meta: trendMeta, src_meta: BUNDLED.src_meta, profile_meta: BUNDLED.profile_meta });
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
