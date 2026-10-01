"use client";
/**
 * 화면 사이 뼈대(2026-10-02 교체) — 사이트 안 링크를 누르면 다음 화면이 올 때까지 뼈대를 보여 준다.
 *
 * 전에는 `(site)/loading.tsx`(Suspense 경계)로 했는데, 그 방식은 **처음 내려가는 HTML에도 뼈대가 들어가고 본문은 숨긴 조각으로 뒤에 붙어**
 * 자바스크립트가 자리를 바꿔 줘야 보였다(홈·술·음식 상세·모음 전부 — 검색봇이 스크립트를 안 돌리면 뼈대만 본다, 실측).
 * 그래서 뼈대는 **누른 뒤에만** 브라우저에서 띄우고, 서버가 내려 주는 HTML에는 본문이 제자리에 그대로 있게 했다.
 * 없는 주소가 200으로 답하던 것도 같은 원인(흘려 보내기 시작한 뒤라 상태를 못 바꿈)이라 함께 풀린다.
 *
 * 판정: 보통 왼쪽 클릭 + 같은 사이트 + 다른 경로일 때만. 새 탭·내려받기·버튼(하트 등)·같은 화면 안 이동은 건드리지 않는다.
 * 경로가 바뀌면 끄고, 6초가 지나도 안 바뀌면(이동이 취소됨) 끈다.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function NavPending({ children, skeleton }: { children: ReactNode; skeleton: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { setPending(false); clearTimeout(timer.current); }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const t = e.target as Element | null;
      // 링크 안의 버튼(하트·공유 등)은 화면을 옮기지 않는다
      if (!t?.closest || t.closest("button, [role='button'], input, select, textarea, label")) return;
      const a = t.closest("a");
      if (!a || !a.getAttribute("href")) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      let u: URL;
      try { u = new URL(a.href, window.location.href); } catch { return; }
      if (u.origin !== window.location.origin || u.pathname === window.location.pathname) return;
      // 화면이 아닌 주소(그림·API·피드)와 다른 구역(어드민)은 문서째 새로 받는다
      if (/\.[a-z0-9]{2,5}$/i.test(u.pathname) || u.pathname.startsWith("/api/") || u.pathname.startsWith("/admin")) return;
      setPending(true);
      window.scrollTo(0, 0);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPending(false), 6000);
    };
    // 캡처 단계 — next/link가 클릭을 가로채(preventDefault) 버블 단계에서는 '이미 처리됨'으로 보인다
    document.addEventListener("click", onClick, true);
    const onShow = () => setPending(false);   // 뒤로 가기로 되살아난 화면(bfcache)에 뼈대가 남지 않게
    window.addEventListener("pageshow", onShow);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("pageshow", onShow); clearTimeout(timer.current); };
  }, []);

  return (
    <>
      {pending && skeleton}
      <div style={{ display: pending ? "none" : "contents" }}>{children}</div>
    </>
  );
}
