import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { publish } from "@/lib/admin-data";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { const b = await req.json().catch(() => ({})); const r = await publish(String(b.note || "").slice(0, 200)); return NextResponse.json(r); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
