import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { removeExpertReview } from "@pairinggo/server/expert-reviews";
import { invalidateCatalog } from "@/lib/catalog";
import { actOnExpert, renameExpert, setExpertTier, type ExpertAction } from "@/lib/experts";
export const runtime = "nodejs";

/** 전문가 승인·반려·정지·재개 — { userId, action, reason, displayName } · 표시명만 바꾸기 — { userId, action: "rename", displayName } · 판정 지우기(활동 탭) — { userId, action: "review-remove", reviewId } */
export async function POST(req: Request) {
  const g = await guardApi(); if (g) return g;
  try {
    const b = (await req.json()) as { userId?: string; action?: ExpertAction | "rename" | "review-remove" | "tier"; reason?: string; displayName?: string; reviewId?: number; tier?: number };
    if (b.action === "review-remove") {
      await removeExpertReview(String(b.userId ?? ""), Number(b.reviewId));
      invalidateCatalog(); revalidatePath("/drinks/[slug]", "page"); revalidatePath("/foods/[slug]", "page");
    } else if (b.action === "rename") await renameExpert(String(b.userId ?? ""), String(b.displayName ?? ""));
    else if (b.action === "tier") await setExpertTier(String(b.userId ?? ""), b.tier);
    else await actOnExpert(String(b.userId ?? ""), b.action as ExpertAction, String(b.reason ?? ""), b.displayName);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
