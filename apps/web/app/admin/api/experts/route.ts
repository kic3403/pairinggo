import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { actOnExpert, renameExpert, type ExpertAction } from "@/lib/experts";
export const runtime = "nodejs";

/** 전문가 승인·반려·정지·재개 — { userId, action, reason, displayName } · 표시명만 바꾸기 — { userId, action: "rename", displayName } */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { userId?: string; action?: ExpertAction | "rename"; reason?: string; displayName?: string };
    if (b.action === "rename") await renameExpert(String(b.userId ?? ""), String(b.displayName ?? ""));
    else await actOnExpert(String(b.userId ?? ""), b.action as ExpertAction, String(b.reason ?? ""), b.displayName);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
