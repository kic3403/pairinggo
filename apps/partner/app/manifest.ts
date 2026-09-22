import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "페어링GO 파트너",
    short_name: "GO 파트너",
    description: "페어링GO 제휴 매장(식당·양조장·리쿼샵)용 예약·매장 관리",
    start_url: "/",
    display: "standalone",
    background_color: "#F3F5F8",
    theme_color: "#22406B",
    lang: "ko",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
