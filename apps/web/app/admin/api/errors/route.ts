import { NextResponse } from "next/server";
import { resolveError } from "@pairinggo/server/errors";
import { guardApi } from "@/lib/admin-auth";
export const runtime = "nodejs";

/** 오류 "해결" 표시 — { id }. 같은 오류가 다시 나면 자동으로 미해결로 돌아온다 */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  const b = (await req.json().catch(() => ({}))) as { id?: number };
  if (!Number.isFinite(Number(b.id))) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  await resolveError(Number(b.id));
  return NextResponse.json({ ok: true });
}
