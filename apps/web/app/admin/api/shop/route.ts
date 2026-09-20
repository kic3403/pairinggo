/** 어드민 — 입점 승인·정지·수수료율 */
import { NextResponse } from "next/server";
import { setSellerStatus, type SellerStatus } from "@pairinggo/server/shop";
import { guardApi } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { id: string; status: SellerStatus; feeRate?: number };
    await setSellerStatus(b.id, b.status, b.feeRate);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
