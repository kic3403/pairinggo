import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { resolveDrinkRequest } from "@/lib/drink-requests";
export const runtime = "nodejs";

/** 회원 요청 처리 — { id, status: "open"|"done"|"rejected", drinkId?, note? } */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { id?: number; status?: string; drinkId?: string; note?: string };
    await resolveDrinkRequest(Number(b.id), { status: b.status, drinkId: b.drinkId, note: b.note });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
