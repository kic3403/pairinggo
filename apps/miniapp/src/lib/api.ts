/**
 * 서버 API 클라이언트 — VITE_API_BASE_URL 이 비어 있으면 아무것도 호출하지 않는다 (Phase 1과 동일하게 내장 데이터만).
 * 실패는 조용히(null) 처리: 앱은 항상 번들 데이터로 동작해야 한다.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";
export const apiEnabled = () => !!API_BASE;

import type { Place } from "@pairinggo/shared";

export type PlacesResponse = { food?: string; kind?: string; query?: string; center: { lat: number; lng: number; radius: number } | null; places: Place[]; total: number; source: "kakao" | "none"; error?: string };

/** 내 주변 식당 / 판매점 (서버가 카카오 로컬 호출). 서버·키 없으면 null */
export async function fetchPlaces(kind: "restaurants" | "bottleshops", params: Record<string, string | number | undefined>): Promise<PlacesResponse | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  const r = await fetchJson<PlacesResponse>(`/places/${kind}?${qs}`, { timeoutMs: 8000 });
  return r.ok ? r.data : null;
}

export async function fetchJson<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ ok: true; data: T; headers: Headers } | { ok: false; status: number }> {
  if (!API_BASE) return { ok: false, status: 0 };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 4000);
  try {
    const res = await fetch(API_BASE + "/api/v1" + path, { ...init, signal: ctrl.signal, headers: { Accept: "application/json", ...(init.headers || {}) } });
    if (res.status === 304) return { ok: false, status: 304 };
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T, headers: res.headers };
  } catch {
    return { ok: false, status: -1 };
  } finally {
    clearTimeout(t);
  }
}
