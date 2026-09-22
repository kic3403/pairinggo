import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./partner.css";

export const metadata: Metadata = {
  title: { default: "페어링GO 파트너", template: "%s · 페어링GO 파트너" },
  description: "페어링GO 제휴 매장(식당·양조장·리쿼샵)용 예약·매장 관리",
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "GO 파트너", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#22406B" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
