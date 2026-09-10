/**
 * 카카오맵 JS SDK 지연 로드 — VITE_KAKAO_JS_KEY(도메인 제한 공개 키)가 없으면 지도 기능을 숨긴다.
 */
export const KAKAO_JS_KEY = (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) || "";
export const mapEnabled = () => !!KAKAO_JS_KEY;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { kakao?: any } }

let loading: Promise<any> | null = null;
export function loadKakaoMaps(): Promise<any> {
  if (!KAKAO_JS_KEY) return Promise.reject(new Error("카카오 JS 키 없음"));
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    s.async = true;
    s.onload = () => { try { window.kakao.maps.load(() => resolve(window.kakao.maps)); } catch (e) { reject(e); } };
    s.onerror = () => { loading = null; reject(new Error("카카오맵 SDK 로드 실패")); };
    document.head.appendChild(s);
  });
  return loading;
}
