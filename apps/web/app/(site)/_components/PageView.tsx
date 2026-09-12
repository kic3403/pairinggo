"use client";
/** 화면 진입 이벤트(screen) — 경로가 바뀔 때마다 한 번. 유입 경로(referrer)는 첫 화면에만 붙인다. */
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

export default function PageView() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const ref = first.current ? (document.referrer || "").slice(0, 200) : "";
    first.current = false;
    track("screen", { ref, q: window.location.search.slice(0, 120) });
  }, [pathname]);
  return null;
}
