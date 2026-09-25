/** 먹어봤나요? 개수 — 로그인 회원의 저장한 술·음식 중 아직 평가하지 않은 조합(마이페이지 TriedCard와 같은 규칙, 2026-09-25 홈 알약용) */
import { NextResponse } from "next/server";
import { D, byDrink, byFood, scorePairings, suggestTried } from "@pairinggo/shared";
import { auth } from "@/auth";
import { getCatalog } from "@/lib/catalog";
import { myRatings } from "@/lib/ratings";
import { listSaved } from "@/lib/saved";

export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ count: 0 }, { status: 401 });
  try {
    await getCatalog();
    const [rows, rated] = await Promise.all([listSaved(uid), myRatings(uid).catch(() => new Set<string>())]);
    const tried = suggestTried({
      savedDrinks: rows.filter((r) => r.kind === "drink").map((r) => r.item_id), savedFoods: rows.filter((r) => r.kind === "food").map((r) => r.item_id),
      rated, byDrink, byFood, rank: (p) => scorePairings(p, (x) => D[x.d]?.category || "").map((s) => s.p),
    });
    return NextResponse.json({ count: tried.length });
  } catch { return NextResponse.json({ count: 0 }); }
}
