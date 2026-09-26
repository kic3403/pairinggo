import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { deleteNotice, saveNotice } from "@/lib/notifications";
export const runtime = "nodejs";

/** 공지 저장(POST, id가 있으면 수정) · 삭제(DELETE {id}) */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { return NextResponse.json({ ok: true, id: await saveNotice(await req.json()) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
export async function DELETE(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { const b = (await req.json()) as { id?: number }; await deleteNotice(Number(b.id)); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
