import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { deletePlaceInfo, savePlaceInfo } from "@/lib/place-info";
export const runtime = "nodejs";
/** 식당 정보 저장(POST) · 삭제(DELETE ?id=) — 저장하면 공개 식당 목록에 바로 보인다(식당 검색 API가 매번 place_info를 붙인다) */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { return NextResponse.json({ ok: true, row: await savePlaceInfo(await req.json()) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
export async function DELETE(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { await deletePlaceInfo(String(new URL(req.url).searchParams.get("id") || "")); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
