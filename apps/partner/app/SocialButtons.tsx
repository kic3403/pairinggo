/**
 * 파트너 앱 간편로그인 버튼 — 카카오(#FEE500·검은 말풍선)·네이버(#03C75A·흰 N) 디자인 가이드 색·심볼 그대로.
 * 누르면 /api/oauth/{p}/start 로 — 처음 쓰는 계정이면 가입 신청 화면으로 이어진다.
 */
import type { OAuthProvider } from "@pairinggo/shared";

const LABEL: Record<OAuthProvider, string> = { kakao: "카카오 로그인", naver: "네이버 로그인" };

function Sym({ p }: { p: OAuthProvider }) {
  return p === "kakao" ? (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#000" d="M9 1.5C4.58 1.5 1 4.33 1 7.82c0 2.26 1.5 4.25 3.76 5.36l-.96 3.5c-.08.3.26.55.52.38l4.2-2.78c.16.01.32.02.48.02 4.42 0 8-2.83 8-6.32S13.42 1.5 9 1.5Z" /></svg>
  ) : (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="#fff" d="M10.85 8.56 4.98 0H0v16h5.15V7.44L11.02 16H16V0h-5.15v8.56Z" /></svg>
  );
}

export function SocialButtons({ providers, verb = "로그인" }: { providers: OAuthProvider[]; verb?: "로그인" | "가입" }) {
  if (!providers.length) return null;
  return (
    <div className="social">
      <div className="social-div"><span>간편{verb}</span></div>
      {providers.map((p) => (
        <a key={p} className={`social-btn social-${p}`} href={`/api/oauth/${p}/start?mode=login`}>
          <span className="social-sym"><Sym p={p} /></span>{LABEL[p]}
        </a>
      ))}
    </div>
  );
}
