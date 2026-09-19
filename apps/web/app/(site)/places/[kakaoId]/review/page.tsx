/** 리뷰 쓰기(2026-09-19) — 방문 인증(예약 방문 완료 또는 영수증) + 휴대폰 인증 회원만. 인증·저장은 /api/reviews* */
import type { Metadata } from "next";
import Link from "next/link";
import { placeBase } from "@/lib/place-detail";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "리뷰 쓰기 | 페어링GO", robots: { index: false, follow: false } };

export default async function WriteReviewPage({ params, searchParams }: { params: Promise<{ kakaoId: string }>; searchParams: Promise<{ n?: string }> }) {
  const { kakaoId } = await params;
  const p = await placeBase(kakaoId, (await searchParams).n).catch(() => null);
  if (!p) {
    return (
      <div className="wrap">
        <h1>식당을 찾지 못했어요</h1>
        <div className="btns"><Link className="btn" href="/places">식당 찾기</Link></div>
      </div>
    );
  }
  const back = `/places/${kakaoId}?n=${encodeURIComponent(p.name)}`;
  return (
    <div className="wrap rvw" style={{ maxWidth: 640 }}>
      <p className="crumb"><Link href={back}>{p.name}</Link> · 리뷰 쓰기</p>
      <h1>{p.name} 리뷰 쓰기</h1>
      <p className="muted" style={{ marginTop: -4 }}>{p.address}</p>
      <ReviewForm kakaoId={kakaoId} placeName={p.name} back={back} />
    </div>
  );
}
