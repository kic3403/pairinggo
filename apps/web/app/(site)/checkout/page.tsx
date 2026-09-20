/** 주문서 — 로그인 필요. 결제(PG)는 계약 전이라 시험 주문만 열려 있다(docs/22) */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCart, testPayEnabled } from "@/lib/shop";
import CheckoutForm from "./CheckoutForm";

export const metadata: Metadata = { title: "주문서 | 페어링GO", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) redirect("/login?next=/checkout");
  const cart = await getCart(uid);
  if (!cart.groups.length) redirect("/cart");
  return (
    <div className="wrap">
      <h1>주문서</h1>
      <CheckoutForm cart={cart} payReady={testPayEnabled()} me={{ name: session?.user?.name ?? "", phone: "" }} />
    </div>
  );
}
