/** PWA 아이콘 192px — 파비콘과 같은 두 점. maskable 영역(가운데 80%) 안에 들어가게 여백을 둔다 */
import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBFAF7" }}>
        <div style={{ width: 72, height: 72, borderRadius: 36, background: "#22406B" }} />
        <div style={{ width: 72, height: 72, borderRadius: 36, background: "#E4572E", marginLeft: -26, opacity: 0.92 }} />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
