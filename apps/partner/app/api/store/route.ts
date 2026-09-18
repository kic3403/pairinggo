import { saveStoreInfo } from "@pairinggo/server/merchant-store";
import { approvedOrError } from "@/lib/partner";

/** 매장 정보 저장 — 페어링GO 식당 카드에 바로 반영(변경 이력 남김) */
export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  try {
    const b = (await req.json()) as { phone?: string; info?: Record<string, unknown> };
    return Response.json({ ok: true, info: await saveStoreInfo(a.merchant, a.user, b) });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
