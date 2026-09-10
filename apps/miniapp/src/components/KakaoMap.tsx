import { useEffect, useRef, useState } from "react";
import type { Place } from "@pairinggo/shared";
import { loadKakaoMaps, mapEnabled } from "@/lib/kakaoMap";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 카카오맵 — 중심 + 장소 마커. 마커 탭 시 onSelect. SDK는 처음 렌더 때 지연 로드 */
export default function KakaoMap({ center, places, selected, onSelect, height = 260 }:
  { center: { lat: number; lng: number } | null; places: Place[]; selected?: string | null; onSelect?: (id: string) => void; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!mapEnabled() || !el.current) return;
    let alive = true;
    loadKakaoMaps().then((maps) => {
      if (!alive || !el.current) return;
      const c = center ?? (places[0] ? { lat: places[0].lat, lng: places[0].lng } : { lat: 37.5665, lng: 126.978 });
      if (!mapRef.current) mapRef.current = new maps.Map(el.current, { center: new maps.LatLng(c.lat, c.lng), level: 5 });
      const map = mapRef.current;
      for (const m of markers.current) m.setMap(null);
      markers.current = [];
      const bounds = new maps.LatLngBounds();
      if (center) {
        const me = new maps.Marker({ position: new maps.LatLng(center.lat, center.lng), map, zIndex: 3 });
        markers.current.push(me); bounds.extend(me.getPosition());
      }
      places.forEach((p, i) => {
        const pos = new maps.LatLng(p.lat, p.lng);
        const marker = new maps.Marker({ position: pos, map, title: p.name, zIndex: p.id === selected ? 4 : 2 });
        const label = new maps.CustomOverlay({ position: pos, yAnchor: 2.3, content: `<div style="font:600 11px/1 sans-serif;background:${p.id === selected ? "#E4572E" : "#22406B"};color:#fff;border-radius:999px;padding:3px 7px;white-space:nowrap">${i + 1}</div>` });
        label.setMap(map);
        maps.event.addListener(marker, "click", () => onSelect?.(p.id));
        markers.current.push(marker, label); bounds.extend(pos);
      });
      if (places.length) map.setBounds(bounds, 30, 30, 30, 30);
      else if (center) map.setCenter(new maps.LatLng(center.lat, center.lng));
    }).catch((e) => setErr((e as Error).message));
    return () => { alive = false; };
  }, [center?.lat, center?.lng, places, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current || !selected) return;
    const p = places.find((x) => x.id === selected);
    if (p && window.kakao?.maps) mapRef.current.panTo(new window.kakao.maps.LatLng(p.lat, p.lng));
  }, [selected, places]);

  if (!mapEnabled()) return null;
  return (
    <div className="relative rounded-xl overflow-hidden border border-line bg-surface2" style={{ height }}>
      <div ref={el} className="w-full h-full" aria-label="지도" />
      {err && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-muted">지도를 불러오지 못했어요 · {err}</div>}
    </div>
  );
}
