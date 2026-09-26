import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { adminActDrinkReview } from "@/lib/drink-reviews";
export const runtime = "nodejs";

/** 술 평가 숨김·복구·삭제 — { id, action: "hide"|"restore"|"delete", reason? } */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { id?: number; action?: "hide" | "restore" | "delete"; reason?: string };
    if (!["hide", "restore", "delete"].includes(String(b.action))) throw new Error("알 수 없는 처리예요");
    await adminActDrinkReview(Number(b.id), b.action!, String(b.reason ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
