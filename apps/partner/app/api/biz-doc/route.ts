import { replaceMerchantBizDocs } from "@pairinggo/server/partner-docs";
import { rateLimit } from "@pairinggo/server/kakao";
import { approvedOrError } from "@/lib/partner";

export const runtime = "nodejs";

/** 사업자등록증 올리기·바꾸기(2026-09-29, 0048) — POST { images: [{ type, data(base64 JPEG) }] }(1~2장). 운영자만 보는 비공개 저장소 */
export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  if (!rateLimit(req, 5, "biz-doc")) return Response.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  try {
    const b = (await req.json().catch(() => ({}))) as { images?: { data: string }[] };
    const n = await replaceMerchantBizDocs(a.merchant.id, b.images ?? []);
    return Response.json({ ok: true, count: n });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
