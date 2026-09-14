"use client";
/**
 * 카카오 JS SDK 로드 + 초기화 — NEXT_PUBLIC_KAKAO_JS_KEY(도메인 제한 공개 키)가 있을 때만. 없으면 ShareButton이 기기 공유창·복사로 넘어간다.
 * 카카오 콘솔 [앱] → [플랫폼 키] → JavaScript 키의 "JS SDK 도메인"에 pairinggo.vercel.app(과 localhost:3000)이 등록돼 있어야 동작한다.
 */
import Script from "next/script";

declare global { interface Window { Kakao?: { isInitialized(): boolean; init(key: string): void; Share: { sendDefault(o: unknown): void } } } }

export default function KakaoSdk() {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return null;
  return (
    <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js" strategy="lazyOnload" crossOrigin="anonymous"
      onLoad={() => { try { if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(key); } catch { /* 키·도메인 오류 — 공유는 다른 방법으로 */ } }} />
  );
}
