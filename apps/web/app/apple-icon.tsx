/** 아이폰 홈 화면 아이콘(180px) — 파비콘과 같은 두 점을 크게 */
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBFAF7" }}>
        <div style={{ width: 84, height: 84, borderRadius: 42, background: "#22406B" }} />
        <div style={{ width: 84, height: 84, borderRadius: 42, background: "#E4572E", marginLeft: -30, opacity: 0.92 }} />
      </div>
    ),
    size,
  );
}
