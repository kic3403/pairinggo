/** 주문 만들기·취소 — 로그인 본인만. 결제는 PG 계약 전이라 시험 주문(SHOP_TEST_PAY=1)만 만들 수 있다. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { CONSENT_VERSION } from "@pairinggo/shared";
import { auth } from "@/auth";
import { myOrderByNo, placeOrder, testPayEnabled, transitionOrder } from "@/lib/shop";

const Address = z.object({
  name: z.string().max(20), phone: z.string().max(20), zip: z.string().max(10),
  addr1: z.string().max(120), addr2: z.string().max(60), memo: z.string().max(100),
});
const Body = z.object({ address: Address, agree: z.boolean() });
const Cancel = z.object({ orderNo: z.string().max(20), reason: z.string().max(100).optional() });

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (!testPayEnabled()) return NextResponse.json({ error: "결제 준비 중이에요 — 곧 열립니다" }, { status: 503 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "주문 정보를 다시 확인해 주세요" }, { status: 400 });
  if (!body.data.agree) return NextResponse.json({ error: "판매자에게 주문 정보를 전달하는 데 동의해 주세요" }, { status: 400 });
  try {
    const order = await placeOrder(uid, { address: body.data.address, consentVersion: CONSENT_VERSION });
    return NextResponse.json({ ok: true, orderNo: order.orderNo });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

/** 손님 취소 — 발송 전까지 */
export async function PATCH(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const body = Cancel.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  const order = await myOrderByNo(uid, body.data.orderNo);
  if (!order) return NextResponse.json({ error: "주문을 찾지 못했어요" }, { status: 404 });
  try {
    await transitionOrder({ orderId: order.id, to: "cancelled", actor: "user", reason: body.data.reason });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
