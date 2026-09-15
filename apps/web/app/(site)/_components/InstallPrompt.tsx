"use client";
/**
 * 홈 화면에 추가 안내(PWA, docs/20 P1-3) — 휴대폰 브라우저에서만, 이미 앱처럼 열린 상태(standalone)면 안 보인다.
 *  · 안드로이드 크롬: beforeinstallprompt를 받아 두었다가 "추가" 버튼으로 설치창을 띄운다
 *  · 아이폰 사파리: 설치 API가 없어 "공유 → 홈 화면에 추가" 방법을 알려 준다
 * 닫으면 7일 동안 다시 안 보인다(localStorage). 서비스워커(/sw.js)도 여기서 등록한다.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const KEY = "pg_install_dismissed";
const HIDE_DAYS = 7;

export default function InstallPrompt() {
  const pathname = usePathname() || "/";
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [bip, setBip] = useState<BIP | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => null);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try { const t = Number(localStorage.getItem(KEY) || 0); if (Date.now() - t < HIDE_DAYS * 86400000) return; } catch { /* 사설 모드 */ }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (ios) { setMode("ios"); return; }
    const onBip = (e: Event) => { e.preventDefault(); setBip(e as BIP); setMode("android"); };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  // 상세 화면은 하단 고정 버튼이 있어 겹친다 — 목록·홈에서만
  if (!mode || /^\/(drinks|foods)\/[^/]+/.test(pathname) || /^\/(login|signup|profile|withdraw)/.test(pathname)) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* 무시 */ } setMode(null); };
  const install = async () => {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    track("external_link", { kind: "pwa_install", outcome });
    if (outcome === "accepted") setMode(null); else dismiss();
  };
  return (
    <div className="install" role="region" aria-label="홈 화면에 추가">
      <span className="dots" aria-hidden><i /><i /></span>
      <div className="in-t">
        <b>홈 화면에 추가</b>
        <span className="small">{mode === "ios" ? "아래 공유 버튼 → ‘홈 화면에 추가’를 누르면 앱처럼 열려요" : "앱처럼 바로 열 수 있어요"}</span>
      </div>
      {mode === "android" && <button type="button" className="btn p xs" onClick={() => void install()}>추가</button>}
      <button type="button" className="in-x" onClick={dismiss} aria-label="닫기">✕</button>
    </div>
  );
}
