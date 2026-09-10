import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { reject } from "@/lib/admin-data";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try { const b = await req.json(); await reject(Number(b.candidateId), String(b.reason || "").slice(0, 200), String(b.reviewer || "운영자").slice(0, 40)); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
