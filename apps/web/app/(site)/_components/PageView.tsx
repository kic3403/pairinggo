"use client";
/** 화면 진입 이벤트(screen) — 경로가 바뀔 때마다 한 번. 유입 경로(referrer)는 첫 화면에만 붙인다. */
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track } from "@/lib/track";
import { inAppOf } from "@pairinggo/shared/traffic-source";

export default function PageView() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const firstDoc = first.current;
    const ref = firstDoc ? (document.referrer || "").slice(0, 200) : "";
    first.current = false;
    // via = 앱 안 브라우저(카카오톡·인스타 등 — 직전 주소를 안 넘겨 줘서 브라우저 정보로 알아낸다, 2026-10-02). 문서의 첫 화면에만
    track("screen", { ref, q: window.location.search.slice(0, 120), ...(firstDoc ? { via: inAppOf(navigator.userAgent) } : {}) });
  }, [pathname]);
  return null;
}
