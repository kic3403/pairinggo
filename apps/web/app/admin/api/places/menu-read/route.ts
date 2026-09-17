import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { guardApi } from "@/lib/admin-auth";
import { MENU_IMAGE_MAX_B64, MENU_IMAGE_TYPES, MENU_IMAGES_MAX, menuReadConfigured, readMenuImages, type MenuImageType } from "@/lib/menu-read";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 메뉴판 사진 읽기: POST { images: [{ type, data(base64) }] } → { items, note }. 사진은 저장하지 않는다 */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  if (!menuReadConfigured()) return NextResponse.json({ error: "메뉴판 읽기가 꺼져 있어요 — ANTHROPIC_API_KEY를 설정해 주세요" }, { status: 503 });
  let body: { images?: { type?: string; data?: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "사진을 받지 못했어요" }, { status: 400 }); }
  const images = (body.images ?? []).slice(0, MENU_IMAGES_MAX);
  if (!images.length) return NextResponse.json({ error: "메뉴판 사진을 골라 주세요" }, { status: 400 });
  for (const img of images) {
    if (!MENU_IMAGE_TYPES.includes(img.type as MenuImageType) || typeof img.data !== "string" || !img.data) return NextResponse.json({ error: "JPG·PNG·WEBP 사진만 읽을 수 있어요" }, { status: 400 });
    if (img.data.length > MENU_IMAGE_MAX_B64) return NextResponse.json({ error: "사진이 너무 커요" }, { status: 413 });
  }
  try {
    return NextResponse.json(await readMenuImages(images as { type: MenuImageType; data: string }[]));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "잠시 요청이 많아요. 조금 뒤 다시 시도해 주세요" }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "AI 키가 올바르지 않아요 — ANTHROPIC_API_KEY를 확인해 주세요" }, { status: 503 });
    if (e instanceof Anthropic.BadRequestError) { console.warn("[menu-read]", e.message); return NextResponse.json({ error: "사진을 읽지 못했어요. 다른 사진으로 시도해 주세요" }, { status: 400 }); }
    if (e instanceof Anthropic.APIError) { console.warn("[menu-read]", e.status, e.message); return NextResponse.json({ error: "AI 서버 오류예요. 잠시 뒤 다시 시도해 주세요" }, { status: 502 }); }
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
