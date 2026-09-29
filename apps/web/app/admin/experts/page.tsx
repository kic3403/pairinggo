/**
 * 어드민 — 전문가 검수 신청 승인·반려·정지(docs/27). 심사 중이 맨 앞. 증빙 사진은 비공개 버킷의 10분짜리 서명 주소로만 본다.
 * 승인 때 표시명(실명 · 소속 / 실명 직함)을 고칠 수 있고, 이미 남긴 판정의 근거 줄도 함께 바뀐다.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { docSignedUrls, expertActivity, listExperts, recentExpertReviews } from "@/lib/experts";
import ExpertActivityList from "./ExpertActivityList";
import { DocThumbs, KV, fmtTime } from "../_components/Detail";
import { COMPENSATION_LABEL, EXPERT_STATUSES, EXPERT_STATUS_LABEL, VERDICT_LABEL, type ExpertStatus, type ExpertVerdict } from "@pairinggo/shared";
import ExpertActions from "./ExpertActions";

export const dynamic = "force-dynamic";

export default async function AdminExpertsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const all = await listExperts();
  // 활동 탭(2026-09-29) — 승인·정지된 전문가의 판정 기록
  if (sp.view === "activity") {
    const act = await expertActivity();
    return (
      <>
        <h2 style={{ margin: "0 0 8px" }}>전문가 등급 <span className="muted">활동 · 전문가 {act.length}명 · 판정 {act.reduce((s, x) => s + x.counts.total, 0)}개</span></h2>
        <div className="filters">
          <Link href="/admin/experts">요청·심사</Link>
          <Link href="/admin/experts?view=activity" className="on">활동</Link>
        </div>
        <p className="muted" style={{ marginBottom: 10 }}>전문가 등급 회원(승인·정지)이 남긴 판정이에요. 잘못되거나 대가성으로 보이는 판정은 <b>지우기</b>로 없앨 수 있고, 카드의 근거 줄·올라간 등급·배지 집계도 함께 되돌아가요.</p>
        <ExpertActivityList items={act} />
      </>
    );
  }
  const tab = EXPERT_STATUSES.includes(sp.status as ExpertStatus) ? (sp.status as ExpertStatus) : null;
  const rows = tab ? all.filter((r) => r.status === tab) : all;
  const docs = await Promise.all(rows.map((r) => (r.docPaths.length ? docSignedUrls(r.docPaths) : Promise.resolve([] as (string | null)[]))));
  const waiting = all.filter((r) => r.status === "applied").length;
  const recent = await recentExpertReviews(rows.map((r) => r.userId)).catch(() => new Map());
  const PROVIDER: Record<string, string> = { email: "이메일", kakao: "카카오", naver: "네이버", google: "구글" };
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>전문가 등급 <span className="muted">등급 요청 대기 {waiting} · {tab ? `${EXPERT_STATUS_LABEL[tab]} ${rows.length}` : `전체 ${all.length}`}</span></h2>
      <div className="filters">
        <Link href="/admin/experts?view=activity">활동 보기 →</Link>
        <span className="chip">|</span>
        <Link href="/admin/experts" className={tab === null ? "on" : ""}>전체 {all.length}</Link>
        {EXPERT_STATUSES.map((s) => <Link key={s} href={`/admin/experts?status=${s}`} className={tab === s ? "on" : ""}>{EXPERT_STATUS_LABEL[s]} {all.filter((r) => r.status === s).length}</Link>)}
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>
        승인 전에 자격증 사진(필수)과 소개를 보고 실제 전문가인지 확인해 주세요. 승인하면 <b>표시명</b>을 고칠 수 있고(기본은 이름 · 소속 / 이름 직함 — 실명 비공개를 고른 사람은 닉네임), 판정마다 그 이름이 카드에 실려요. 비공개를 고른 전문가의 실명은 표시명에 넣지 마세요.
        전문가 한 명의 "어울림"은 바로 소믈리에 근거가 되고, 2명 이상 동의하면 "전문가 추천" 배지가 붙어요. 정지하면 그 사람 판정은 배지 집계에서 빠집니다(재개하면 되살아남).
        테스트 기간에는 보수가 없어요 — 출시 뒤 협찬·자문료를 드리면 카드에 표시합니다.
      </p>
      {rows.length === 0 ? <div className="card muted">{tab ? `${EXPERT_STATUS_LABEL[tab]} 전문가가 없어요.` : "아직 등급 요청이 없어요."}</div> : rows.map((x, i) => (
        <div className="card" key={x.userId}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <b style={{ fontSize: 16 }}>{x.realName}{!x.namePublic && <span className="tag m" style={{ marginLeft: 6 }} title="카드에는 닉네임으로">실명 비공개 · {x.penName}</span>} <span className="muted" style={{ fontWeight: 400 }}>{x.titles.join(" · ")}{x.affiliation ? ` · ${x.affiliation}` : ""}</span></b>
            <span className={`tag${x.status === "approved" ? " g" : x.status === "applied" ? " w" : x.status === "suspended" ? " v" : " m"}`}>{EXPERT_STATUS_LABEL[x.status]}</span>
          </div>
          <KV rows={[
            ["실명", x.realName],
            ["실명 공개", x.namePublic ? "공개" : `비공개 — 카드에는 닉네임 ‘${x.penName}’`],
            ["직함", x.titles.join(" · ")],
            ["소속", x.affiliation || "없음"],
            ["카드 표시명", <b key="n">{x.displayName}</b>],
            ["소개", x.intro || "없음"],
            ["보상", COMPENSATION_LABEL[x.compensation] || "없음(테스트 기간)"],
            ["회원", `${x.nick ?? "-"}${x.email ? ` · ${x.email}` : ""} · ${PROVIDER[x.provider ?? ""] ?? x.provider ?? "-"} 가입${x.joinedAt ? ` ${fmtTime(x.joinedAt)}` : ""} · 휴대폰 ${x.phoneVerified ? "인증함" : "인증 안 함"}`],
            ["요청", fmtTime(x.appliedAt)],
            ["공개 동의", fmtTime(x.publicConsentAt)],
            ["승인", fmtTime(x.approvedAt)],
            ["마지막 변경", fmtTime(x.updatedAt)],
            ["상태 사유", x.rejectReason],
            ["검수", `${x.reviewsCount}건`],
            ...((recent.get(x.userId) ?? []) as { drink: string; food: string; verdict: string; note: string; at: string }[]).map((r, k): [string, React.ReactNode] => [k === 0 ? "최근 판정" : " ", `${r.drink} × ${r.food} — ${VERDICT_LABEL[r.verdict as ExpertVerdict] ?? r.verdict}${r.note ? ` · ${r.note}` : ""} (${fmtTime(r.at)})`]),
          ]} />
          <DocThumbs label="자격증" urls={docs[i]} missing="없음 — 자격증 사진이 필수가 되기 전(2026-09-29) 요청" />
          <ExpertActions userId={x.userId} status={x.status} displayName={x.displayName} />
        </div>
      ))}
    </>
  );
}
