/**
 * 리뷰 — 내 매장의 방문 인증 리뷰와 사장님 답글(2026-10-01). 답글은 리뷰마다 하나, 손님 화면 "사장님 답글"로 보인다.
 */
import { listMerchantReviews } from "@pairinggo/server/review-replies";
import { Bar, Tabs } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import ReviewReplies from "./ReviewReplies";

export const metadata = { title: "리뷰" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const { merchant } = await requireApprovedMerchant();
  const reviews = await listMerchantReviews(merchant);
  const avg = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null;
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <h1>리뷰 {reviews.length > 0 && <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>{reviews.length}개 · 평균 ★ {avg}</span>}</h1>
          <p className="lead" style={{ margin: 0 }}>다녀간 손님이 <b>방문을 인증</b>하고 남긴 리뷰예요. 답글을 달면 페어링GO 매장 화면에 <b>“사장님 답글”</b>로 보입니다(반영은 길어야 10분). 답글은 리뷰마다 하나, 고치거나 지울 수 있어요.</p>
        </div>
        <ReviewReplies reviews={reviews} />
      </main>
      <Tabs active="reviews" kind={merchant.kind} />
    </>
  );
}
