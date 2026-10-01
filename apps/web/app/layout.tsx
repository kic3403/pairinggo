import type { Metadata } from "next";
import type { ReactNode } from "react";

import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "페어링GO", template: "%s" },
  description: "페어링고(페어링GO) — 전통주를 검색하면 어울리는 음식을, 음식을 검색하면 어울리는 전통주를 근거와 함께.",
  applicationName: "페어링GO",
  formatDetection: { telephone: false },
  // 검색엔진 소유 확인(2026-09-28) — 구글 서치 콘솔·네이버 서치어드바이저·빙 웹마스터에서 받은 "HTML 태그" 값만 환경변수로(공개 값, 비밀 아님)
  verification: siteVerification(),
};

function siteVerification(): Metadata["verification"] {
  const other: Record<string, string> = {};
  if (process.env.NAVER_SITE_VERIFICATION) other["naver-site-verification"] = process.env.NAVER_SITE_VERIFICATION;
  if (process.env.BING_SITE_VERIFICATION) other["msvalidate.01"] = process.env.BING_SITE_VERIFICATION;
  return { ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}), ...(Object.keys(other).length ? { other } : {}) };
}

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#22406B" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>{/* 시작 화면 스크립트가 첫 그리기 전에 html에 no-splash를 붙인다(개발 모드 수화 경고 억제) */}
      {/* 색은 각 구역 CSS(site.css · admin.css)가 정한다. 여기서 고정하면 다크 모드 토큰과 충돌한다 */}
      <body style={{ margin: 0, fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
