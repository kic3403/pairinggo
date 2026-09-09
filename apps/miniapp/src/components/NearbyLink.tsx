import type { ReactNode } from "react";
import { useRegion } from "@/lib/prefs";
import ExtLink from "./ExtLink";

/** 관심지역이 반영된 네이버지도 링크. children 없이 쓰면 "{내 주변|부산} {name} ..." 문구를 만든다. */
export default function NearbyLink({ name, suffix = "", className, children, tail = "" }:
  { name: string; suffix?: string; className?: string; children?: ReactNode; tail?: string }) {
  const { near, mapNear } = useRegion();
  return (
    <ExtLink href={mapNear(`${name} ${suffix}`.trim())} kind="map" className={className} meta={{ q: name }}>
      {children ?? `${near} ${name}${tail}`}
    </ExtLink>
  );
}
/** 문구만 필요할 때 (예: "관심지역 부산 기준") */
export function RegionNote({ className }: { className?: string }) {
  const { st, cur } = useRegion();
  if (st.gps) return <span className={className}>현재 위치 기준</span>;
  if (st.id === "all") return <span className={className}>관심지역을 고르면 그 지역 기준으로 찾습니다</span>;
  return <span className={className}>관심지역 {cur.label} 기준 · 홈에서 바꿀 수 있어요</span>;
}
