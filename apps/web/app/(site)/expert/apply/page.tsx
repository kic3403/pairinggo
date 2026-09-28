/**
 * 전문가 신청(docs/27) — 소믈리에·요리연구가·양조장 관계자 등 회원이 실명·소속·직함·증빙을 내고 운영자 승인을 기다린다.
 * 승인되면 /expert에서 페어링을 판정하고, 판정은 실명(소속 또는 직함)과 함께 카드에 실린다.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EXPERT_STATUS_LABEL } from "@pairinggo/shared";
import { auth } from "@/auth";
import { getExpert } from "@/lib/experts";
import ExpertApplyForm from "./ExpertApplyForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "전문가 검수 신청 | 페어링GO", robots: { index: false } };

export default async function ExpertApplyPage() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) redirect("/login?next=%2Fexpert%2Fapply");
  const x = await getExpert(uid).catch(() => null);
  if (x?.status === "approved") redirect("/expert");
  return (
    <div className="wrap" style={{ maxWidth: 520 }}>
      <p className="crumb"><Link href="/my">마이페이지</Link></p>
      <h1>전문가 검수 신청</h1>
      <p className="lead">소믈리에·요리연구가·양조사·셰프처럼 술과 음식을 다루는 분이 페어링을 검수해 주는 자리예요. 운영자가 자격을 확인해 승인하면 검수 화면이 열립니다.</p>
      <div className="box">
        <h3>이렇게 쓰여요</h3>
        <ul>
          <li>술 × 음식 조합마다 <b>어울림 · 보통 · 아님</b>과 한 줄 이유를 남겨요.</li>
          <li>판정은 <b>이름과 소속(소속이 없으면 직함)</b>과 함께 페어링 카드에 실려요. 이름은 실명이 기본이고, 비공개를 고르면 닉네임으로 보여요. 증빙 사진·연락처는 공개하지 않아요.</li>
          <li>전문가 2명 이상이 어울린다고 하면 <b>전문가 추천</b>, 5명 이상 <b>전문가 적극 추천</b>, 10명 이상 <b>전문가 Best 페어링</b> 배지가 붙어요.</li>
          <li>테스트 기간에는 보수가 없어요. 정식 출시 뒤 협찬·건당 사례를 드릴 때는 카드에 그 사실을 표시합니다.</li>
        </ul>
      </div>
      {x?.status === "applied" && <p className="form-ok">심사 중이에요 — {new Date(x.appliedAt).toLocaleDateString("ko-KR")} 신청. 결과는 알림과 마이페이지로 알려 드려요.</p>}
      {x?.status === "suspended" && <p className="form-error">전문가 활동이 정지된 계정이에요{x.rejectReason ? ` — ${x.rejectReason}` : ""}. 문의는 마이페이지 아래 안내를 참고해 주세요.</p>}
      {x?.status === "rejected" && <p className="form-error">지난 신청은 반려됐어요{x.rejectReason ? ` — ${x.rejectReason}` : ""}. 아래에서 다시 신청할 수 있어요.</p>}
      {(!x || x.status === "rejected") && <ExpertApplyForm defaults={x ? { realName: x.realName, affiliation: x.affiliation, titles: x.titles, intro: x.intro, namePublic: x.namePublic, penName: x.penName } : null} nick={session.user?.name ?? ""} />}
      {x && x.status !== "rejected" && <p className="small muted" style={{ marginTop: 12 }}>상태: {EXPERT_STATUS_LABEL[x.status]} · 표시명 {x.displayName}</p>}
      <p className="small muted" style={{ marginTop: 18 }}><Link href="/terms">이용약관 제8조의3(전문가 검수)</Link> · <Link href="/privacy">개인정보처리방침</Link></p>
    </div>
  );
}
