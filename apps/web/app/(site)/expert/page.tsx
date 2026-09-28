/**
 * 전문가 검수 화면(docs/27) — 승인된 전문가만. 대기열(어울림 1명 → 근거 확인 → 추정 순)에 어울림·보통·아님 + 한 줄 이유,
 * 내 검수 목록(삭제), 새 페어링 제안(술·음식을 골라 어울림으로). 판정은 실명(소속 또는 직함)과 함께 카드에 실린다.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCatalog } from "@/lib/catalog";
import { getExpert } from "@/lib/experts";
import ExpertReview from "./ExpertReview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "전문가 검수 | 페어링GO", robots: { index: false } };

export default async function ExpertPage() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) redirect("/login?next=%2Fexpert");
  const x = await getExpert(uid).catch(() => null);
  if (!x || x.status !== "approved") redirect("/expert/apply");
  const c = await getCatalog();
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "ko");
  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <p className="crumb"><Link href="/my">마이페이지</Link></p>
      <h1>전문가 검수 <span className="muted small">{x.displayName}</span></h1>
      <p className="lead">조합마다 <b>어울림 · 보통 · 아님</b>을 골라 주세요. 어울림은 바로 소믈리에 근거로 실리고, 2명 이상 동의하면 "전문가 추천" 배지가 붙어요. 한 줄 이유는 카드에 <b>{x.displayName}</b> 이름으로 보입니다.</p>
      <ExpertReview
        displayName={x.displayName}
        drinks={[...c.dataset.drinks].sort(byName).map((d) => ({ id: d.id, name: d.name }))}
        foods={[...c.dataset.foods].sort(byName).map((f) => ({ id: f.id, name: f.name }))}
      />
    </div>
  );
}
