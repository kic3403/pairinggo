import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { saveDrinkAdmin } from "@/lib/admin-drinks";
export const runtime = "nodejs";
/** 술 정보(주종·속성·규격·참고가격) 저장 + 발행(POST) — 0원·0mL·불완전한 가격 줄은 서버가 거른다 */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { return NextResponse.json({ ok: true, ...(await saveDrinkAdmin(await req.json())) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
