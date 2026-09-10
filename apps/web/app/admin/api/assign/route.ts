import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { assignEntity } from "@/lib/admin-data";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { const b = await req.json(); const r = await assignEntity(Number(b.candidateId), b.drinkId ? String(b.drinkId) : null, b.foodId ? String(b.foodId) : null); return NextResponse.json(r); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
