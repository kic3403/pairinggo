"use client";
/**
 * 로그인 상태와 저장 목록을 한곳에서 관리한다. 헤더와 하트 버튼이 모두 이걸 쓴다.
 *
 * 두 가지를 신경 썼다.
 *  1) 하트가 여러 개인 화면에서 버튼마다 조회하면 요청이 폭주한다 → 한 번만 받아 나눠 쓴다.
 *  2) 앱 라우터는 화면을 옮겨도 레이아웃을 다시 만들지 않는다. 로그인 직후에도 이 컴포넌트가
 *     그대로 남아 예전 상태를 보여 주므로, 경로가 바뀌면 세션을 다시 확인한다.
 *  3) 비로그인 하트(2026-10-01)는 로그인으로 보내지 않고 기기(localStorage)에 담는다. 로그인하면 계정으로
 *     옮기고 기기 목록을 비운다(규칙 shared guest-saved.ts, API /api/saved/merge). 첫 화면 로그아웃 판정과는 무관.
 */
import { usePathname, useRouter } from "next/navigation";
import { GUEST_SAVED_KEY, guestToMerge, parseGuestSaved, shouldClearSession, toggleGuestSaved, type ExpertStatus, type GuestSavedItem } from "@pairinggo/shared";
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
  /** 전문가 검수 상태(docs/27) — approved면 헤더에 "검수" 링크 */
  expert: ExpertStatus | null;
  has: (kind: SavedKind, id: string) => boolean;
  toggle: (kind: SavedKind, id: string, meta?: PlaceMeta) => Promise<void>;
};

/** 기기에 담은 저장 — 사설 모드 등으로 저장소를 못 쓰면 빈 목록 */
const readGuest = (): GuestSavedItem[] => { try { return parseGuestSaved(window.localStorage.getItem(GUEST_SAVED_KEY)); } catch { return []; } };
const writeGuest = (list: GuestSavedItem[]) => { try { if (list.length) window.localStorage.setItem(GUEST_SAVED_KEY, JSON.stringify(list)); else window.localStorage.removeItem(GUEST_SAVED_KEY); } catch { /* 저장소 없음 */ } };
const guestKeys = (list: GuestSavedItem[]) => new Set(list.map((x) => key(x.kind, x.id)));
/** 이 탭에서 기기 저장 안내를 길게 보여 줬는지 */
const HINT_KEY = "pg_guest_hint";

const SavedCtx = createContext<Ctx>({ ready: false, loggedIn: false, user: null, expert: null, has: () => false, toggle: async () => {} });
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
  const [expert, setExpert] = useState<ExpertStatus | null>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ text: string; login?: boolean } | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.login ? 4500 : 2500); return () => clearTimeout(t); }, [toast]);

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
      if (!s?.user) { setUser(null); setExpert(null); setKeys(guestKeys(readGuest())); setReady(true); return; }
      setUser({ name: s.user.name ?? null, email: s.user.email ?? null });
      const [j, c] = await Promise.all([
        fetch("/api/saved").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/account/consent").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!alive) return;
      // 간편가입 직후·약관 변경·닉네임 없음 — 가입 마무리 화면으로(consent.ts CONSENT_VERSION, profile.ts nicknameProblem)
      if (c?.needed && !CONSENT_FREE.includes(pathname)) router.replace(`/profile?next=${encodeURIComponent(pathname)}`);
      setExpert((c?.expert as ExpertStatus | null) ?? null);
      const account = new Set<string>((j?.items || []).map((x: { kind: SavedKind; item_id: string }) => key(x.kind, x.item_id)));
      // 비로그인 때 기기에 담은 것 — 계정에 없는 것만 옮기고 기기 목록을 비운다(목록을 못 받았으면 다음 기회에)
      const guest = j ? readGuest() : [];
      const todo = guestToMerge(guest, account);
      if (guest.length) {
        const ok = !todo.length || await fetch("/api/saved/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: todo.map(({ kind, id, meta }) => ({ kind, id, meta })) }) }).then((r) => r.ok).catch(() => false);
        if (!alive) return;
        if (ok) {
          writeGuest([]);
          for (const x of todo) account.add(key(x.kind, x.id));
          if (todo.length) setToast({ text: `기기에 저장한 ${todo.length}개를 계정으로 옮겼어요` });
        }
      }
      setKeys(account);
      setReady(true);
    })();
    return () => { alive = false; };
  }, [pathname]);

  const has = useCallback((k: SavedKind, id: string) => keys.has(key(k, id)), [keys]);

  const toggle = useCallback(async (k: SavedKind, id: string, meta?: PlaceMeta) => {
    const kk = key(k, id);
    if (!user) {
      // 비로그인 — 기기에 담는다. 저장 이벤트는 guest 표시를 달아 남긴다(대시보드 저장 수에 들어감)
      const { list, saved } = toggleGuestSaved(readGuest(), k, id, meta, Date.now());
      writeGuest(list);
      setKeys(guestKeys(list));
      if (saved) {
        track("save", { ...(k === "drink" ? { d: id } : k === "food" ? { f: id } : { place: id }), kind: k, food: meta?.food ?? null, guest: true });
        let first = true;
        try { first = !window.sessionStorage.getItem(HINT_KEY); window.sessionStorage.setItem(HINT_KEY, "1"); } catch { /* 저장소 없음 */ }
        setToast(first ? { text: "이 기기에 저장했어요 · 로그인하면 계정으로 옮겨요", login: true } : { text: "이 기기에 저장했어요", login: true });
      } else setToast({ text: "저장을 해제했어요" });
      return;
    }
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
  }, [keys, user]);

  const value = useMemo(() => ({ ready, loggedIn: !!user, user, expert, has, toggle }), [ready, user, expert, has, toggle]);
  return (
    <SavedCtx.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.login && !user && <> · <a className="toast-link" href={`/login?next=${encodeURIComponent(pathname)}`}>로그인</a></>}
        </div>
      )}
    </SavedCtx.Provider>
  );
}
