/**
 * 카탈로그 핫스왑 — 시작 시 ① 로컬 캐시(pgo_catalog) 즉시 적용 ② 서버 버전 비교 ③ 다르면 내려받아 적용·저장.
 * 번들 JSON은 항상 폴백. 데이터가 바뀌어도 앱 재검수 없이 반영된다.
 */
import { useSyncExternalStore } from "react";
import { applyDataset, CATALOG_SOURCE, CATALOG_VERSION, CatalogResponseSchema, type CatalogResponse, type Dataset } from "@pairinggo/shared";
import { apiEnabled, fetchJson } from "./api";

const KEY = "pgo_catalog";
type State = { version: string; source: "bundled" | "server"; checkedAt: number | null; status: "idle" | "checking" | "updated" | "offline" };
let state: State = { version: CATALOG_VERSION, source: CATALOG_SOURCE, checkedAt: null, status: "idle" };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; subs.forEach((s) => s()); };
export function useCatalog() {
  return useSyncExternalStore((s) => { subs.add(s); return () => { subs.delete(s); }; }, () => state, () => state);
}

function applyFromServer(payload: CatalogResponse) {
  const { version, ...ds } = payload;
  applyDataset(ds as unknown as Dataset, version, "server");
  set({ version, source: "server" });
}

let started = false;
export async function bootstrapCatalog() {
  if (started) return; started = true;
  // ① 로컬 캐시
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const parsed = CatalogResponseSchema.safeParse(JSON.parse(raw)); if (parsed.success) applyFromServer(parsed.data); }
  } catch { /* 캐시 손상 → 무시 */ }
  if (!apiEnabled()) return;
  // ② 서버 버전 비교
  set({ status: "checking" });
  const v = await fetchJson<{ version: string; counts: { drinks: number; foods: number; pairings: number } }>("/catalog/version");
  if (!v.ok) { set({ status: "offline", checkedAt: Date.now() }); return; }
  if (v.data.version === state.version) { set({ status: "idle", checkedAt: Date.now() }); return; }
  // ③ 내려받기
  const c = await fetchJson<CatalogResponse>("/catalog", { timeoutMs: 10000 });
  if (!c.ok) { set({ status: "offline", checkedAt: Date.now() }); return; }
  const parsed = CatalogResponseSchema.safeParse(c.data);
  if (!parsed.success) { console.warn("[catalog] 서버 카탈로그 형식 오류", parsed.error.issues.slice(0, 3)); set({ status: "offline", checkedAt: Date.now() }); return; }
  try {
    applyFromServer(parsed.data);
    try { localStorage.setItem(KEY, JSON.stringify(parsed.data)); } catch { /* 용량 초과 등 → 다음 시작에 다시 받음 */ }
    set({ status: "updated", checkedAt: Date.now() });
  } catch (e) {
    console.warn("[catalog] 적용 실패", (e as Error).message);
    set({ status: "offline", checkedAt: Date.now() });
  }
}

/** 마이 화면 초기화용 */
export function clearCatalogCache() { try { localStorage.removeItem(KEY); } catch { /* noop */ } }
