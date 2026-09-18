import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { actOnMerchant, type MerchantAction } from "@/lib/partners-admin";
export const runtime = "nodejs";

/** 파트너 매장 승인·반려·정지·재개 — { id, action, reason } */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { id?: string; action?: MerchantAction; reason?: string };
    await actOnMerchant(String(b.id ?? ""), b.action as MerchantAction, String(b.reason ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
