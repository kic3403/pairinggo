"use client";
/**
 * 공유 버튼 — 카카오톡 → 기기 공유창 → 링크 복사 순으로 되는 것을 쓴다(docs/20 P0-2, 유입이 지인 공유뿐이라 버튼이 있어야 한다).
 *  · 카카오톡: Kakao JS SDK(KakaoSdk.tsx가 NEXT_PUBLIC_KAKAO_JS_KEY 있을 때만 로드)로 피드 카드 — 그림은 그 화면의 og:image(opengraph-image.tsx)
 *  · 기기 공유창(navigator.share): 휴대폰 크롬·사파리 — 카톡·문자·인스타 DM 등 뭐든 고르게
 *  · 복사: 데스크톱 등 — 클립보드에 링크
 * 어느 방법이든 share 이벤트를 남긴다(method).
 */
import { useState } from "react";
import { track } from "@/lib/track";

declare global { interface Window { Kakao?: { isInitialized(): boolean; init(key: string): void; Share: { sendDefault(o: unknown): void } } } }

/** 클립보드 API가 막힌 브라우저(권한·iframe)에서는 숨은 입력칸 + execCommand로 */
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 아래 방법 */ }
  try {
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}

type Props = { title: string; text: string; path?: string; d?: string; f?: string; pick?: number; className?: string; label?: string };

export default function ShareButton({ title, text, path, d, f, pick, className = "btn", label = "공유" }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const share = async () => {
    const url = new URL(path ?? window.location.pathname, window.location.origin).toString();
    const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? undefined;
    const done = (method: string) => { track("share", { method, d: d ?? null, f: f ?? null, pick: pick ?? null }); };
    const K = window.Kakao;
    if (K?.isInitialized?.()) {
      try {
        K.Share.sendDefault({ objectType: "feed", content: { title, description: text, imageUrl: image ?? `${window.location.origin}/opengraph-image`, link: { mobileWebUrl: url, webUrl: url } }, buttons: [{ title: "페어링 보기", link: { mobileWebUrl: url, webUrl: url } }] });
        done("kakao"); return;
      } catch { /* SDK 오류 — 다음 방법 */ }
    }
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title, text, url }); done("native"); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    if (await copyText(url)) { setMsg("링크를 복사했어요"); done("copy"); }
    else setMsg("주소창의 링크를 복사해 주세요");
    setTimeout(() => setMsg(null), 2500);
  };
  return (
    <span className="share-wrap">
      <button type="button" className={className} onClick={() => void share()} aria-label={`${title} 공유`}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
        {" "}{label}
      </button>
      {msg && <span className="share-msg" role="status">{msg}</span>}
    </span>
  );
}
