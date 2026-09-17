import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { searchPlaces } from "@/lib/kakao";
export const runtime = "nodejs";
/** 어드민 식당 찾기: ?q=대전 둔산동 해물파전 → 카카오 로컬(음식점) 상위 15곳. 운영자가 누를 때만 부른다 */
export async function GET(req: Request) {
  const g = await guardApi(); if (g) return g;
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ places: [] });
  try {
    const r = await searchPlaces({ query: q, category: "FD6", sort: "accuracy" });
    return NextResponse.json({ places: r.places.slice(0, 15).map((p) => ({ id: p.id, name: p.name, category: p.category, address: p.roadAddress || p.address, phone: p.phone, lat: p.lat, lng: p.lng, placeUrl: p.placeUrl })), source: r.source });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
