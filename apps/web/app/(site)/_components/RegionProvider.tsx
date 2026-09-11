"use client";
/**
 * 관심지역 — 캐치테이블처럼 한 곳을 골라 두면 검색·전통주 목록·주변 식당/판매점이 그 지역 기준으로 움직인다.
 * 기기(localStorage)에 남기고, 현재 위치를 허용하면 좌표로 지역을 추정해 넣는다. 로그인과 무관.
 * 지역 정의는 packages/shared/src/regions.ts (데이터 JSON을 끌고 오지 않도록 "@pairinggo/shared/regions"로만 가져온다).
 */
import { estimateRegion, regionById, regionLabel, type Region } from "@pairinggo/shared/regions";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const KEY = "pg_region";
const MAX_RECENT = 6;
type Gps = { lat: number; lng: number; at: number };
type Stored = { id: string; gps: Gps | null; recent: string[] };

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

const load = (): Stored => {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) { const s = JSON.parse(raw) as Stored; if (s && typeof s.id === "string") return { id: s.id, gps: s.gps ?? null, recent: Array.isArray(s.recent) ? s.recent : [] }; }
  } catch { /* 사설 모드 등 — 기본값 */ }
  return { id: "all", gps: null, recent: [] };
};
const save = (s: Stored) => { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 무시 */ } };

export default function RegionProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<Stored>({ id: "all", gps: null, recent: [] });
  const [ready, setReady] = useState(false);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => { setSt(load()); setReady(true); }, []);

  const setRegion = useCallback((id: string) => {
    setSt((prev) => {
      const valid = id === "all" || !!regionById(id);
      const next: Stored = { id: valid ? id : "all", gps: null, recent: id === "all" ? prev.recent : [id, ...prev.recent.filter((x) => x !== id)].slice(0, MAX_RECENT) };
      save(next); return next;
    });
  }, []);
  const reset = useCallback(() => setSt((prev) => { const next = { id: "all", gps: null, recent: prev.recent }; save(next); return next; }), []);

  const locate = useCallback(() => new Promise<string | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const id = estimateRegion(lat, lng) ?? "all";
        setSt((prev) => { const next: Stored = { id, gps: { lat, lng, at: Date.now() }, recent: id === "all" ? prev.recent : [id, ...prev.recent.filter((x) => x !== id)].slice(0, MAX_RECENT) }; save(next); return next; });
        resolve(id);
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }), []);

  const value = useMemo<Ctx>(() => {
    const region = regionById(st.id);
    const gps = st.gps && Date.now() - st.gps.at < 30 * 60 * 1000 ? st.gps : null;
    return { ready, id: region ? region.id : "all", region, label: region ? regionLabel(region) : "전국", gps, recent: st.recent, isOpen, open: () => setOpen(true), close: () => setOpen(false), setRegion, reset, locate };
  }, [st, ready, isOpen, setRegion, reset, locate]);

  return <RegionCtx.Provider value={value}>{children}</RegionCtx.Provider>;
}
