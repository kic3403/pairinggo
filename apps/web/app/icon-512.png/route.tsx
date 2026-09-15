/** PWA 아이콘 512px(any·maskable 겸용) — 가운데 80% 안에 그린다 */
import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBFAF7" }}>
        <div style={{ width: 190, height: 190, borderRadius: 95, background: "#22406B" }} />
        <div style={{ width: 190, height: 190, borderRadius: 95, background: "#E4572E", marginLeft: -68, opacity: 0.92 }} />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
