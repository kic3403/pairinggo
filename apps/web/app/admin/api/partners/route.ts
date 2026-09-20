import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { actOnMerchant, linkKakaoPlace, setMerchantKind, type MerchantAction } from "@/lib/partners-admin";
export const runtime = "nodejs";

/** 파트너 매장 승인·반려·정지·재개 — { id, action, reason } · 카카오맵 장소 연결 — { id, action: "link", kakaoId, query } · 업종 바꾸기 — { id, action: "kind", kind } */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { id?: string; action?: MerchantAction | "link" | "kind"; reason?: string; kakaoId?: string; query?: string; kind?: string };
    if (b.action === "link") await linkKakaoPlace(String(b.id ?? ""), String(b.kakaoId ?? ""), String(b.query ?? ""));
    else if (b.action === "kind") await setMerchantKind(String(b.id ?? ""), String(b.kind ?? ""));
    else await actOnMerchant(String(b.id ?? ""), b.action as MerchantAction, String(b.reason ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
