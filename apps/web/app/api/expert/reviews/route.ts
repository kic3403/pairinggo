/**
 * 전문가 판정(docs/27) — 승인된 전문가만(requireExpert).
 *  GET → { items }   POST { drinkId, foodId, verdict, note? } → { ok, item }   DELETE ?id= → { ok }
 * 저장·삭제는 packages/server/expert-reviews.ts(pairings·근거 동기화 + 배지 집계 + 카탈로그 버전).
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listExpertReviews, removeExpertReview, saveExpertReview } from "@pairinggo/server/expert-reviews";
import { invalidateCatalog } from "@/lib/catalog";
import { requireExpert } from "@/lib/experts";
import { rateLimit } from "@/lib/kakao";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const Body = z.object({ drinkId: z.string().max(10), foodId: z.string().max(10), verdict: z.enum(["yes", "neutral", "no"]), note: z.string().max(300).optional() });

function refresh() {
  invalidateCatalog();
  revalidatePath("/drinks/[slug]", "page");
  revalidatePath("/foods/[slug]", "page");
}

export async function GET(req: Request) {
  const x = await requireExpert(req); if (x instanceof Response) return x;
  try { return NextResponse.json({ items: await listExpertReviews(x.userId) }, { headers: NO_STORE }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}

export async function POST(req: Request) {
  if (!rateLimit(req, 30, "expert-review")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요." }, { status: 429, headers: NO_STORE });
  const x = await requireExpert(req); if (x instanceof Response) return x;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  try {
    const item = await saveExpertReview(x, parsed.data);
    refresh();
    return NextResponse.json({ ok: true, item }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}

export async function DELETE(req: Request) {
  const x = await requireExpert(req); if (x instanceof Response) return x;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400, headers: NO_STORE });
  try {
    await removeExpertReview(x.userId, id);
    refresh();
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400, headers: NO_STORE }); }
}
