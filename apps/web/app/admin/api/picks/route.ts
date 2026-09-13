import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { hidePick, resolvePick } from "@/lib/member-picks";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = await req.json();
    const id = Number(b.id);
    if (!id) throw new Error("id 없음");
    if (b.action === "hide") { await hidePick(id, String(b.note || "").slice(0, 200)); return NextResponse.json({ ok: true }); }
    const r = await resolvePick(id, String(b.drinkId || ""), String(b.foodId || ""), String(b.note || "").slice(0, 200));
    return NextResponse.json({ ok: true, n: r.n });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
