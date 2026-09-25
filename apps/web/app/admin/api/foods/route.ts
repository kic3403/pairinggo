import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { saveFoodImage } from "@/lib/admin-foods";
export const runtime = "nodejs";
/** 음식 사진 주소·출처 저장 + 발행(POST) — 잘못된 주소는 400 */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { return NextResponse.json({ ok: true, ...(await saveFoodImage(await req.json())) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
