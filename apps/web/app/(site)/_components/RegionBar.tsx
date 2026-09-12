"use client";
/** 헤더 아래 지역 줄 — "📍 서울 ▾"를 누르면 관심지역 설정 화면, 오른쪽은 현재 위치로 바로 설정. */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useHydrated, useRegion } from "./RegionProvider";

export default function RegionBar() {
  const rg = useRegion();
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const locate = async () => {
    setBusy(true);
    const id = await rg.locate();
    setBusy(false);
    if (!id) { rg.open(); return; }   // 거부·실패 → 직접 고르게
    const q = new URLSearchParams(sp.toString());
    if (id === "all") q.delete("region"); else q.set("region", id);
    const qs = q.toString();
    if (pathname === "/search" || pathname === "/drinks") router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="region-bar">
      <div className="wrap">
        <button type="button" className="rb-region" onClick={rg.open} aria-haspopup="dialog" aria-expanded={rg.isOpen}>
          <span className="pin" aria-hidden>📍</span>
          <b>{hydrated && rg.ready ? rg.label : "전국"}</b>
          <span className="caret" aria-hidden>▾</span>
          <span className="small muted rb-hint">관심지역</span>
        </button>
        <button type="button" className="rb-loc" onClick={locate} disabled={busy}>◎ {busy ? "확인 중…" : "현재 위치로"}</button>
      </div>
    </div>
  );
}
