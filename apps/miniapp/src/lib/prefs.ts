/**
 * 클라이언트 상태 — 관심지역 · 저장(찜) · 최근 검색.
 * localStorage에 best-effort로 보관하고 useSyncExternalStore로 구독한다.
 * (Phase 3: 토스 로그인 후 서버 사용자 테이블로 이관, 로그인 전엔 로컬 유지)
 */
import { useSyncExternalStore } from "react";
import { REGIONS, RBY, estimateRegion, naverMapUrl } from "@pairinggo/shared";

export type RegionState = { id: string; gps: boolean; lat: number | null; lng: number | null; est: string | null };
const DEFAULT_REGION: RegionState = { id: "all", gps: false, lat: null, lng: null, est: null };

/* ---------- 저장(찜) ---------- */
export type SavedItem =
  | { k: "pair"; d: string; f: string; t?: number }
  | { k: "drink"; id: string; t?: number }
  | { k: "food"; id: string; t?: number }
  | { k: "place"; name: string; food?: string; region?: string; address?: string; url?: string; rating?: number | null; t?: number };
export function savedKey(x: SavedItem) {
  return x.k === "pair" ? `pair:${x.d}:${x.f}` : x.k === "place" ? `place:${x.name}` : `${x.k}:${x.id}`;
}

/* ---------- 최근 검색 ---------- */
export type RecentItem = { type: "drink" | "food"; id: string; name: string };

/* ---------- 작은 외부 스토어 ---------- */
export function makeStore<T>(key: string, def: T) {
  let cache: T | undefined; const subs = new Set<() => void>();
  const read = (): T => {
    if (cache !== undefined) return cache;
    if (typeof window === "undefined") return def;
    try { const v = localStorage.getItem(key); cache = v == null ? def : (JSON.parse(v) as T); } catch { cache = def; }
    return cache as T;
  };
  const write = (v: T) => { cache = v; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 저장 불가 환경은 메모리만 */ } subs.forEach((s) => s()); };
  const subscribe = (s: () => void) => { subs.add(s); return () => { subs.delete(s); }; };
  const use = () => useSyncExternalStore(subscribe, read, () => def);
  return { read, write, subscribe, use };
}
export const regionStore = makeStore<RegionState>("pgo_region", DEFAULT_REGION);
export const savedStore = makeStore<SavedItem[]>("pgo_saved", []);
export const recentStore = makeStore<RecentItem[]>("pgo_recent", []);

/* ---------- 관심지역 helpers ---------- */
export function useRegion() {
  const st = regionStore.use();
  const cur = RBY[st.id] || REGIONS[0];
  const eff = st.gps ? (st.est ? RBY[st.est] : null) : st.id === "all" ? null : cur; // 지역 술 필터용
  const label = st.gps ? `현재 위치${st.est ? ` · ${RBY[st.est].label} 추정` : ""}` : cur.label;
  const near = st.gps || st.id === "all" ? "내 주변" : cur.label; // 문구용
  const q = st.gps ? "" : cur.q;
  const placeQuery = (name: string) => (q ? `${q} ${name}` : name);
  const mapNear = (name: string) => naverMapUrl(placeQuery(name));
  return { st, cur, eff, label, near, q, placeQuery, mapNear };
}
export function setRegion(id: string) { regionStore.write({ id, gps: false, lat: null, lng: null, est: null }); }
export function setGps(lat: number, lng: number) {
  const st = regionStore.read();
  regionStore.write({ id: st.id, gps: true, lat, lng, est: estimateRegion(lat, lng) });
}

/* ---------- 저장 helpers ---------- */
export function isSaved(list: SavedItem[], x: SavedItem) { const k = savedKey(x); return list.some((s) => savedKey(s) === k); }
export function toggleSaved(x: SavedItem): boolean {
  const l = savedStore.read(); const k = savedKey(x); const was = l.some((s) => savedKey(s) === k);
  savedStore.write(was ? l.filter((s) => savedKey(s) !== k) : [{ ...x, t: Date.now() }, ...l].slice(0, 300));
  return !was;
}

/* ---------- 최근 검색 helpers ---------- */
export function pushRecent(item: RecentItem) {
  const l = recentStore.read().filter((r) => !(r.type === item.type && r.id === item.id));
  recentStore.write([item, ...l].slice(0, 8));
}

/* ---------- 토스트 ---------- */
type ToastEl = HTMLElement & { _t?: number };
export function toast(msg: string) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("pgo-toast") as ToastEl | null;
  if (!el) { el = document.createElement("div") as ToastEl; el.id = "pgo-toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("on");
  clearTimeout(el._t);
  el._t = window.setTimeout(() => el!.classList.remove("on"), 1800);
}
