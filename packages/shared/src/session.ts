/**
 * "첫 화면은 무조건 로그아웃" 판정 (사용자 결정, 2026-09-12 · 2026-09-13 강화).
 *
 * 밖에서 들어온 화면은 로그아웃부터 시작한다 — 카카오톡·문자로 받은 링크, 주소창 입력, 즐겨찾기, 검색 결과.
 * 그래야 링크를 받은 지인이 가입·로그인 화면을 본다. 예외는 두 가지뿐:
 *  1) 새로고침(reload) — 보던 화면을 다시 그리는 것뿐이라 로그인을 끊지 않는다.
 *  2) 로그인·가입을 방금 시도한 직후 — 소셜 로그인은 카카오·네이버를 거쳐 돌아오므로 '밖에서 온 것'처럼 보인다.
 *     로그인/가입 화면에서 폼을 보낼 때 표시를 남기고(authPending), 돌아온 첫 화면에서 한 번 쓰고 지운다.
 * 사이트 안에서 옮겨 다니는 동안(같은 출처에서 온 이동)은 유지된다.
 */
export type SessionEntry = {
  /** 이 탭에서 처음 여는 화면인가 (sessionStorage 표시 없음) */
  firstInTab: boolean;
  /** performance navigation type — "navigate" | "reload" | "back_forward" | "prerender" */
  navType?: string;
  /** document.referrer (없으면 빈 문자열) */
  referrer: string;
  /** location.origin */
  origin: string;
  /** 로그인·가입 폼을 방금 보냈다는 표시 */
  authPending: boolean;
};

/** 주소 앞부분(scheme://host:port)만 떼어 비교 — 이 모듈은 브라우저 전용 API(URL)를 쓰지 않는다(테스트·서버 공용) */
const originOf = (url: string) => (/^https?:\/\/[^/?#]+/i.exec(url) || [""])[0].toLowerCase();
const sameOrigin = (referrer: string, origin: string) => !!referrer && originOf(referrer) === originOf(origin);

export function shouldClearSession(e: SessionEntry): boolean {
  if (e.authPending) return false;          // 로그인 직후(소셜 포함)
  if (e.navType === "reload") return false; // 새로고침
  if (e.firstInTab) return true;            // 새 탭·새 브라우저
  return !sameOrigin(e.referrer, e.origin); // 밖에서 들어온 이동
}
