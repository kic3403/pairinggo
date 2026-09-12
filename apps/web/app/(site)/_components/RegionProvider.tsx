"use client";
/**
 * 관심지역 — 캐치테이블처럼 한 곳을 골라 두면 검색·전통주 목록·주변 식당/판매점이 그 지역 기준으로 움직인다.
 * 기기(localStorage)에 남기고, 현재 위치를 허용하면 좌표로 지역을 추정해 넣는다. 로그인과 무관.
 * 지역 정의는 packages/shared/src/regions.ts (데이터 JSON을 끌고 오지 않도록 "@pairinggo/shared/regions"로만 가져온다).
 *
 * 상태는 useSyncExternalStore로 든다. Suspense 안의 컴포넌트(헤더 지역 줄)는 나중에 하이드레이션되는데, 그때 이미
 * localStorage 값이 올라와 있으면 서버 HTML("전국")과 어긋나 hydration 오류가 난다. 서버 스냅샷을 따로 주면
 * 하이드레이션 때는 서버와 같은 값을 쓰고 그 직후 저장된 값으로 다시 그린다.
 */
import { estimateRegion, regionById, regionLabel, type Region } from "@pairinggo/shared/regions";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

const KEY = "pg_region";
const MAX_RECENT = 6;
type Gps = { lat: number; lng: number; at: number };
type Stored = { id: string; gps: Gps | null; recent: string[]; ready: boolean };

const DEFAULT: Stored = { id: "all", gps: null, recent: [], ready: false };
let store: Stored = DEFAULT;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnapshot = () => store;
const getServerSnapshot = () => DEFAULT;
function setStore(next: Stored) {
  store = next;
  try { window.localStorage.setItem(KEY, JSON.stringify({ id: next.id, gps: next.gps, recent: next.recent })); } catch { /* 사설 모드 등 */ }
  for (const l of listeners) l();
}
function loadOnce() {
  if (store.ready) return;
  let s: Stored = { ...DEFAULT, ready: true };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) { const j = JSON.parse(raw) as Partial<Stored>; if (typeof j.id === "string") s = { id: j.id, gps: j.gps ?? null, recent: Array.isArray(j.recent) ? j.recent : [], ready: true }; }
  } catch { /* 기본값 */ }
  store = s;
  for (const l of listeners) l();
}
const pushRecent = (recent: string[], id: string) => (id === "all" ? recent : [id, ...recent.filter((x) => x !== id)].slice(0, MAX_RECENT));

type Ctx = {
  ready: boolean;
  id: string;                    // "all" = 전국
  region: Region | null;         // 전국이면 null
  label: string;                 // 헤더 표시용
  gps: Gps | null;               // 현재 위치로 설정한 경우의 좌표(30분 지나면 무시)
  recent: string[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setRegion: (id: string) => void;
  reset: () => void;
  /** 브라우저 위치 → 지역 추정. 성공하면 지역 id, 거부·실패면 null */
  locate: () => Promise<string | null>;
};

const RegionCtx = createContext<Ctx>({
  ready: false, id: "all", region: null, label: "전국", gps: null, recent: [], isOpen: false,
  open: () => {}, close: () => {}, setRegion: () => {}, reset: () => {}, locate: async () => null,
});
export const useRegion = () => useContext(RegionCtx);
/**
 * 하이드레이션이 끝났는지 — 하이드레이션 중에는 false(서버와 같은 화면), 그 뒤 true.
 * Suspense 안 컴포넌트는 Provider보다 늦게 하이드레이션되는데 그때 컨텍스트에는 이미 저장된 지역이 들어 있다.
 * 지역에 따라 글자·요소가 달라지는 곳은 이 값이 true일 때만 저장된 지역을 쓴다.
 */
export const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export default function RegionProvider({ children }: { children: ReactNode }) {
  const st = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => { loadOnce(); }, []);

  const setRegion = useCallback((id: string) => {
    const valid = id === "all" || !!regionById(id);
    const vid = valid ? id : "all";
    setStore({ ...store, id: vid, gps: null, recent: pushRecent(store.recent, vid), ready: true });
  }, []);
  const reset = useCallback(() => setStore({ ...store, id: "all", gps: null, ready: true }), []);

  const locate = useCallback(() => new Promise<string | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const id = estimateRegion(lat, lng) ?? "all";
        setStore({ ...store, id, gps: { lat, lng, at: Date.now() }, recent: pushRecent(store.recent, id), ready: true });
        resolve(id);
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }), []);

  const value = useMemo<Ctx>(() => {
    const region = regionById(st.id);
    const gps = st.gps && Date.now() - st.gps.at < 30 * 60 * 1000 ? st.gps : null;
    return { ready: st.ready, id: region ? region.id : "all", region, label: region ? regionLabel(region) : "전국", gps, recent: st.recent, isOpen, open: () => setOpen(true), close: () => setOpen(false), setRegion, reset, locate };
  }, [st, isOpen, setRegion, reset, locate]);

  return <RegionCtx.Provider value={value}>{children}</RegionCtx.Provider>;
}
