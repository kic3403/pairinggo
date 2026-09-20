/** 장바구니 — 로그인한 본인 것만(세션 user.id로 범위가 정해진다) */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { addToCart, getCart, setCartQty } from "@/lib/shop";

const Body = z.object({ productId: z.string().min(1).max(60), qty: z.number().int().min(0).max(20), set: z.boolean().optional() });

export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  return NextResponse.json({ cart: await getCart(uid) });
}

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  try {
    const { productId, qty, set } = body.data;
    if (set || qty === 0) await setCartQty(uid, productId, qty);
    else await addToCart(uid, productId, qty);
    return NextResponse.json({ ok: true, cart: await getCart(uid) });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
