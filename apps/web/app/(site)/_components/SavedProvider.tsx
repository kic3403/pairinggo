"use client";
/**
 * 로그인 상태와 저장 목록을 한곳에서 관리한다. 헤더와 하트 버튼이 모두 이걸 쓴다.
 *
 * 두 가지를 신경 썼다.
 *  1) 하트가 여러 개인 화면에서 버튼마다 조회하면 요청이 폭주한다 → 한 번만 받아 나눠 쓴다.
 *  2) 앱 라우터는 화면을 옮겨도 레이아웃을 다시 만들지 않는다. 로그인 직후에도 이 컴포넌트가
 *     그대로 남아 예전 상태를 보여 주므로, 경로가 바뀌면 세션을 다시 확인한다.
 */
import { usePathname, useRouter } from "next/navigation";
import { shouldClearSession } from "@pairinggo/shared";
import { track } from "@/lib/track";
import { AUTH_PENDING_KEY } from "./AuthAttempt";
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
/** 이 문서에서 첫 화면 판정을 이미 했는지 — 모듈 변수라 앱 라우터 이동에는 유지되고, 새 페이지 로드에서만 초기화된다 */
let entryChecked = false;
/** 약관 동의 전에도 볼 수 있는 화면 — 나머지 화면에서는 가입 마무리(/profile)로 보낸다 */
const CONSENT_FREE = ["/profile", "/privacy", "/terms", "/login", "/signup", "/forgot"];

export default function SavedProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      // 첫 화면은 무조건 로그아웃 상태(사용자 결정) — 밖에서 들어온 화면이면 남아 있던 세션을 지운다.
      // 판정 규칙과 예외(새로고침·로그인 직후)는 packages/shared/src/session.ts.
      let clear = !entryChecked;
      try {
        const ss = window.sessionStorage;
        const authPending = !!ss.getItem(AUTH_PENDING_KEY);
        if (authPending) ss.removeItem(AUTH_PENDING_KEY);
        clear = shouldClearSession({
          firstInTab: !ss.getItem("pg_tab"),
          navType: (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type,
          referrer: document.referrer || "",
          origin: window.location.origin,
          authPending,
          checkedInDocument: entryChecked,
        });
        ss.setItem("pg_tab", "1");
      } catch { /* 사설 모드 등 — 첫 판정이면 지우는 쪽으로 */ }
      entryChecked = true;
      if (clear) await fetch("/api/auth/reset", { method: "POST" }).catch(() => null);
      if (!alive) return;
      const s = await fetch("/api/auth/session").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive) return;
      if (!s?.user) { setUser(null); setKeys(new Set()); setReady(true); return; }
      setUser({ name: s.user.name ?? null, email: s.user.email ?? null });
      const [j, c] = await Promise.all([
        fetch("/api/saved").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/account/consent").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!alive) return;
      // 간편가입 직후·약관 변경·닉네임 없음 — 가입 마무리 화면으로(consent.ts CONSENT_VERSION, profile.ts nicknameProblem)
      if (c?.needed && !CONSENT_FREE.includes(pathname)) router.replace(`/profile?next=${encodeURIComponent(pathname)}`);
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
      if (saved) track("save", { ...(k === "drink" ? { d: id } : k === "food" ? { f: id } : { place: id }), kind: k, food: meta?.food ?? null });
    } catch {
      setKeys((prev) => { const n = new Set(prev); if (was) n.add(kk); else n.delete(kk); return n; });
    }
  }, [keys]);

  const value = useMemo(() => ({ ready, loggedIn: !!user, user, has, toggle }), [ready, user, has, toggle]);
  return <SavedCtx.Provider value={value}>{children}</SavedCtx.Provider>;
}
