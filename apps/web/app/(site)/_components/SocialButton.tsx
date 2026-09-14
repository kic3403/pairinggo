/**
 * 간편로그인 버튼 — 각 회사 디자인 가이드를 따른다(네이버 로그인 검수에서 확인하는 항목). 로그인·회원가입 화면이 같이 쓴다.
 *  · 카카오: 배경 #FEE500, 말풍선 심볼 #000, 레이블 #000 85%, 모서리 12px, 문구 "카카오 로그인"만 허용 — developers.kakao.com/docs/ko/kakaologin/design-guide
 *  · 네이버: 배경 네이버 그린 #03C75A, 흰색 N 로고·레이블
 *  · 구글: 흰 배경 + 회색 테두리 #747775, 4색 G 로고, "Google 계정으로 계속하기" — developers.google.com/identity/branding-guidelines
 * 심볼 모양·비율·색은 바꾸지 않는다. 버튼 크기는 세 버튼이 같게(카카오를 덜 강조하면 안 된다).
 */
import type { SocialProvider } from "@/auth";

const LABEL: Record<SocialProvider, string> = { kakao: "카카오 로그인", naver: "네이버 로그인", google: "Google 계정으로 계속하기" };

function Symbol({ p }: { p: SocialProvider }) {
  if (p === "kakao") return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#000" d="M9 1.5C4.58 1.5 1 4.33 1 7.82c0 2.26 1.5 4.25 3.76 5.36l-.96 3.5c-.08.3.26.55.52.38l4.2-2.78c.16.01.32.02.48.02 4.42 0 8-2.83 8-6.32S13.42 1.5 9 1.5Z" />
    </svg>
  );
  if (p === "naver") return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path fill="#fff" d="M10.85 8.56 4.98 0H0v16h5.15V7.44L11.02 16H16V0h-5.15v8.56Z" />
    </svg>
  );
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** form 안에 넣는 submit 버튼 */
export default function SocialButton({ provider }: { provider: SocialProvider }) {
  return (
    <button type="submit" className={`social-btn social-${provider}`}>
      <span className="social-sym"><Symbol p={provider} /></span>
      <span className="social-label">{LABEL[provider]}</span>
    </button>
  );
}
