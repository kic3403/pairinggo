import type { Metadata } from "next";
import type { ReactNode } from "react";

import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "페어링GO", template: "%s" },
  description: "전통주를 검색하면 어울리는 음식을, 음식을 검색하면 어울리는 전통주를 — 근거와 함께.",
  formatDetection: { telephone: false },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#22406B" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>{/* 시작 화면 스크립트가 첫 그리기 전에 html에 no-splash를 붙인다(개발 모드 수화 경고 억제) */}
      {/* 색은 각 구역 CSS(site.css · admin.css)가 정한다. 여기서 고정하면 다크 모드 토큰과 충돌한다 */}
      <body style={{ margin: 0, fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
