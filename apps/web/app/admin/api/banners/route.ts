import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardApi } from "@/lib/admin-auth";
import { deleteBanner, saveBanner } from "@/lib/banners";
export const runtime = "nodejs";
/** 홈 배너 저장(POST)·삭제(DELETE ?id=) — 저장하면 홈·소식 화면 캐시를 바로 갈아 홈에 즉시 보인다 */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const r = await saveBanner(await req.json());
    if ("error" in r) return NextResponse.json(r, { status: 400 });
    revalidatePath("/"); revalidatePath("/events");
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
export async function DELETE(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { await deleteBanner(String(new URL(req.url).searchParams.get("id") || "")); revalidatePath("/"); revalidatePath("/events"); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
