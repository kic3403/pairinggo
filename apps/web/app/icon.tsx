/** 파비콘 — 헤더 로고와 같은 두 점(남색·주황). 브라우저 탭·북마크·카톡 링크 옆에 뜬다 */
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBFAF7", borderRadius: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 15, background: "#22406B" }} />
        <div style={{ width: 30, height: 30, borderRadius: 15, background: "#E4572E", marginLeft: -11, opacity: 0.92 }} />
      </div>
    ),
    size,
  );
}
