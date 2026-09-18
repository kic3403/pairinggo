import { NextResponse } from "next/server";
import { revertChange } from "@pairinggo/server/merchant-store";
import { guardApi } from "@/lib/admin-auth";
export const runtime = "nodejs";

/** 파트너가 바꾼 매장 정보·영업시간·휴무·예약 설정을 그 직전 값으로 되돌린다 — { id } */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { id?: number };
    await revertChange(Number(b.id));
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
