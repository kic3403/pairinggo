import { rateLimit } from "@pairinggo/server/kakao";
import { uploadMenuPhoto } from "@pairinggo/server/menu-photo";
import { reportError } from "@pairinggo/server/errors";
import { approvedOrError } from "@/lib/partner";

export const runtime = "nodejs";

/**
 * 메뉴·술 한 줄 사진 올리기: POST { data: base64 JPEG } → { url }.
 * 올린 사진은 표에 붙을 뿐이고, 사장님이 [저장]을 눌러야 페어링GO 메뉴판에 보인다.
 */
export async function POST(req: Request) {
  const a = await approvedOrError(); if (a instanceof Response) return a;
  if (!rateLimit(req, 30, "menu-photo")) return Response.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { data?: unknown } | null;
  try {
    return Response.json({ url: await uploadMenuPhoto(a.merchant.id, String(b?.data ?? "")) });
  } catch (e) {
    const msg = (e as Error).message;
    if (/올리지 못했어요/.test(msg)) void reportError("partner", "menu-photo", e);
    return Response.json({ error: msg }, { status: 400 });
  }
}
