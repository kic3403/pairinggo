/** 장바구니 — 로그인 필요(docs/22) */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCart } from "@/lib/shop";
import CartView from "./CartView";

export const metadata: Metadata = { title: "장바구니 | 페어링GO", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login?next=/cart");
  const cart = await getCart(uid);
  return (
    <div className="wrap">
      <h1>장바구니</h1>
      <CartView initial={cart} />
    </div>
  );
}
