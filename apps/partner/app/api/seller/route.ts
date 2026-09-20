import { saveSeller } from "@pairinggo/server/shop";
import { sellerOrError } from "@/lib/seller";

/** 입점 신청·배송 설정 저장 — 승인 상태는 운영자만 바꾼다 */
export async function POST(req: Request) {
  const a = await sellerOrError(); if (a instanceof Response) return a;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const seller = await saveSeller({ id: a.merchant.id, kind: a.merchant.kind, name: a.merchant.name }, body);
    return Response.json({ ok: true, status: seller.status });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
