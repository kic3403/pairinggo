/** 그 술을 지금 살 수 있는 상품(공개) — 술 화면 구매 상자. 재고·가격이 바뀌므로 캐시하지 않는다. */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/kakao";
import { buyOptions } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!rateLimit(req, 60, "shop-products")) return NextResponse.json({ error: "요청이 너무 많아요" }, { status: 429 });
  const drink = new URL(req.url).searchParams.get("drink") ?? "";
  if (!drink) return NextResponse.json({ options: [] });
  try { return NextResponse.json({ options: await buyOptions(drink) }); }
  catch { return NextResponse.json({ options: [] }); }
}
