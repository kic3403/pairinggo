/**
 * 시작 화면(2026-09-25 사용자 요청, 캐치테이블식) — 흰 바탕에 로고와 한 줄 문구가 1.2초 머문 뒤 사라진다.
 *  · 서버 렌더 + CSS 애니메이션. 스크립트는 "이 탭에서 이미 봤는가"만 본다(sessionStorage pg_splash) — 봤으면 <html class="no-splash">를
 *    첫 그리기 전에 붙여 아예 그리지 않는다(layout.tsx의 인라인 스크립트). 새로고침·뒤로가기·앱 라우터 이동에는 안 뜬다.
 *  · 움직임 줄이기 설정이면 0.6초 뒤 바로 사라진다. 보조기기에는 숨긴다(aria-hidden). 본문은 처음부터 그려져 있어 검색 유입도 그대로 읽힌다.
 */
export const SPLASH_TAGLINE = "맛있는 술엔 맛있는 음식";
/** 세션 표시 — 한 탭에서 한 번만. layout.tsx가 <head>에 심는 스크립트와 같은 키 */
export const SPLASH_KEY = "pg_splash";
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem("${SPLASH_KEY}"))document.documentElement.classList.add("no-splash");else sessionStorage.setItem("${SPLASH_KEY}","1")}catch(e){}`;

export default function Splash() {
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-in">
        <p className="splash-tag">{SPLASH_TAGLINE}</p>
        <div className="splash-brand">
          <span className="dots"><i /><i /></span>
          <span>페어링<span className="verm">GO</span></span>
        </div>
      </div>
    </div>
  );
}
