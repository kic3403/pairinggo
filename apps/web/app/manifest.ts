/** PWA 매니페스트 — 휴대폰 "홈 화면에 추가"로 앱처럼 열리게(docs/20 P1-3). 아이콘은 app/icon-192.png·icon-512.png 라우트가 그린다 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "페어링GO — 전통주와 어울리는 음식",
    short_name: "페어링GO",
    description: "전통주를 고르면 어울리는 음식을, 음식을 고르면 어울리는 전통주를 근거와 함께.",
    start_url: "/?src=pwa",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#22406B",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
