import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { checkMenuImages, menuReadConfigured, menuReadError, readMenuImages } from "@/lib/menu-read";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 메뉴판 사진 읽기: POST { images: [{ type, data(base64) }] } → { items, note }. 사진은 저장하지 않는다 */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  if (!menuReadConfigured()) return NextResponse.json({ error: "메뉴판 읽기가 꺼져 있어요 — ANTHROPIC_API_KEY를 설정해 주세요" }, { status: 503 });
  const c = checkMenuImages(await req.json().catch(() => null));
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
  try {
    return NextResponse.json(await readMenuImages(c.images));
  } catch (e) {
    const m = menuReadError(e);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }
}
