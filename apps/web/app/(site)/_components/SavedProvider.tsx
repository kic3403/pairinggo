"use client";
/**
 * 로그인 상태와 저장 목록을 한곳에서 관리한다. 헤더와 하트 버튼이 모두 이걸 쓴다.
 *
 * 두 가지를 신경 썼다.
 *  1) 하트가 여러 개인 화면에서 버튼마다 조회하면 요청이 폭주한다 → 한 번만 받아 나눠 쓴다.
 *  2) 앱 라우터는 화면을 옮겨도 레이아웃을 다시 만들지 않는다. 로그인 직후에도 이 컴포넌트가
 *     그대로 남아 예전 상태를 보여 주므로, 경로가 바뀌면 세션을 다시 확인한다.
 */
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SavedKind = "drink" | "food" | "place";
export type PlaceMeta = { name?: string; address?: string; phone?: string; url?: string; category?: string; food?: string };
type User = { name?: string | null; email?: string | null } | null;

type Ctx = {
  ready: boolean;
  loggedIn: boolean;
  user: User;
  has: (kind: SavedKind, id: string) => boolean;
  toggle: (kind: SavedKind, id: string, meta?: PlaceMeta) => Promise<void>;
};

const SavedCtx = createContext<Ctx>({ ready: false, loggedIn: false, user: null, has: () => false, toggle: async () => {} });
export const useSaved = () => useContext(SavedCtx);
const key = (k: SavedKind, id: string) => `${k}:${id}`;

export default function SavedProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      // 첫 화면은 무조건 로그아웃 상태(사용자 결정) — 이 탭에서 처음 여는 것이면 남아 있던 세션을 지운다.
      // 표시는 탭 단위(sessionStorage)라 로그인 뒤 같은 탭에서 옮겨 다니는 동안은 유지되고, 새 탭·새로 연 브라우저는 다시 로그아웃부터.
      let fresh = false;
      try { fresh = !window.sessionStorage.getItem("pg_tab"); if (fresh) window.sessionStorage.setItem("pg_tab", "1"); } catch { /* 사설 모드 등 — 그냥 진행 */ }
      if (fresh) await fetch("/api/auth/reset", { method: "POST" }).catch(() => null);
      if (!alive) return;
      const s = await fetch("/api/auth/session").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive) return;
      if (!s?.user) { setUser(null); setKeys(new Set()); setReady(true); return; }
      setUser({ name: s.user.name ?? null, email: s.user.email ?? null });
      const j = await fetch("/api/saved").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive) return;
      setKeys(new Set((j?.items || []).map((x: { kind: SavedKind; item_id: string }) => key(x.kind, x.item_id))));
      setReady(true);
    })();
    return () => { alive = false; };
  }, [pathname]);

  const has = useCallback((k: SavedKind, id: string) => keys.has(key(k, id)), [keys]);

  const toggle = useCallback(async (k: SavedKind, id: string, meta?: PlaceMeta) => {
    const kk = key(k, id);
    const was = keys.has(kk);
    // 먼저 바꿔 보여 주고, 실패하면 되돌린다
    setKeys((prev) => { const n = new Set(prev); if (was) n.delete(kk); else n.add(kk); return n; });
    try {
      const r = await fetch("/api/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: k, id, meta }) });
      if (!r.ok) throw new Error();
      const { saved } = await r.json();
      setKeys((prev) => { const n = new Set(prev); if (saved) n.add(kk); else n.delete(kk); return n; });
    } catch {
      setKeys((prev) => { const n = new Set(prev); if (was) n.add(kk); else n.delete(kk); return n; });
    }
  }, [keys]);

  const value = useMemo(() => ({ ready, loggedIn: !!user, user, has, toggle }), [ready, user, has, toggle]);
  return <SavedCtx.Provider value={value}>{children}</SavedCtx.Provider>;
}
