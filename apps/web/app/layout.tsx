import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "페어링GO",
  description: "전통주를 검색하면 어울리는 음식을, 음식을 검색하면 어울리는 전통주를 — 근거와 함께.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif', background: "#F7F6F3", color: "#1F1E1C" }}>{children}</body>
    </html>
  );
}
