import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { createDrinkAdmin } from "@/lib/admin-drinks";
import { resolveDrinkRequest } from "@/lib/drink-requests";
export const runtime = "nodejs";
export const maxDuration = 60;
/** 새 술 등록 + 발행(2026-09-29) — { name, category, abv, brewery, region, desc, buyUrl, buyStore, profile, force?, requestId? }. requestId가 있으면 그 회원 요청을 '등록됨'으로(요청자에게 알림) */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const r = await createDrinkAdmin(b);
    if (b.requestId) await resolveDrinkRequest(Number(b.requestId), { status: "done", drinkId: r.id });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
