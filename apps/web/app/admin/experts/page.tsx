/**
 * 어드민 — 전문가 검수 신청 승인·반려·정지(docs/27). 심사 중이 맨 앞. 증빙 사진은 비공개 버킷의 10분짜리 서명 주소로만 본다.
 * 승인 때 표시명(실명 · 소속 / 실명 직함)을 고칠 수 있고, 이미 남긴 판정의 근거 줄도 함께 바뀐다.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { docSignedUrls, listExperts } from "@/lib/experts";
import { EXPERT_STATUSES, EXPERT_STATUS_LABEL, type ExpertStatus } from "@pairinggo/shared";
import ExpertActions from "./ExpertActions";

export const dynamic = "force-dynamic";

export default async function AdminExpertsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const all = await listExperts();
  const tab = EXPERT_STATUSES.includes(sp.status as ExpertStatus) ? (sp.status as ExpertStatus) : null;
  const rows = tab ? all.filter((r) => r.status === tab) : all;
  const docs = await Promise.all(rows.map((r) => (r.docPaths.length ? docSignedUrls(r.docPaths) : Promise.resolve([] as (string | null)[]))));
  const waiting = all.filter((r) => r.status === "applied").length;
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }) : "-");
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>전문가 검수 <span className="muted">심사 대기 {waiting} · {tab ? `${EXPERT_STATUS_LABEL[tab]} ${rows.length}` : `전체 ${all.length}`}</span></h2>
      <div className="filters">
        <Link href="/admin/experts" className={tab === null ? "on" : ""}>전체 {all.length}</Link>
        {EXPERT_STATUSES.map((s) => <Link key={s} href={`/admin/experts?status=${s}`} className={tab === s ? "on" : ""}>{EXPERT_STATUS_LABEL[s]} {all.filter((r) => r.status === s).length}</Link>)}
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>
        승인 전에 증빙 사진(자격증·명함·재직 확인)과 소개를 보고 실제 전문가인지 확인해 주세요. 승인하면 <b>표시명</b>을 고칠 수 있고(기본은 이름 · 소속 / 이름 직함 — 실명 비공개를 고른 사람은 닉네임), 판정마다 그 이름이 카드에 실려요. 비공개를 고른 전문가의 실명은 표시명에 넣지 마세요.
        전문가 한 명의 "어울림"은 바로 소믈리에 근거가 되고, 2명 이상 동의하면 "전문가 추천" 배지가 붙어요. 정지하면 그 사람 판정은 배지 집계에서 빠집니다(재개하면 되살아남).
        테스트 기간에는 보수가 없어요 — 출시 뒤 협찬·자문료를 드리면 카드에 표시합니다.
      </p>
      {rows.length === 0 ? <div className="card muted">{tab ? `${EXPERT_STATUS_LABEL[tab]} 전문가가 없어요.` : "아직 신청이 없어요."}</div> : rows.map((x, i) => (
        <div className="card" key={x.userId}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <b style={{ fontSize: 16 }}>{x.realName}{!x.namePublic && <span className="tag m" style={{ marginLeft: 6 }} title="카드에는 닉네임으로">실명 비공개 · {x.penName}</span>} <span className="muted" style={{ fontWeight: 400 }}>{x.titles.join(" · ")}{x.affiliation ? ` · ${x.affiliation}` : ""}</span></b>
            <span className={`tag${x.status === "approved" ? " g" : x.status === "applied" ? " w" : x.status === "suspended" ? " v" : " m"}`}>{EXPERT_STATUS_LABEL[x.status]}</span>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 6 }}>카드 표시명 <b>{x.displayName}</b>{x.compensation !== "none" && <span className="tag m" style={{ marginLeft: 6 }}>{x.compensation === "paid" ? "유료 자문" : "협찬"}</span>}</div>
          {x.intro && <div style={{ fontSize: 13.5, marginTop: 4 }}>{x.intro}</div>}
          <div className="muted" style={{ marginTop: 4 }}>
            회원 {x.nick ?? "-"}{x.email ? ` · ${x.email}` : ""} · 신청 {fmt(x.appliedAt)}{x.approvedAt ? ` · 승인 ${fmt(x.approvedAt)}` : ""} · 공개 동의 {fmt(x.publicConsentAt)} · 검수 {x.reviewsCount}건
            {x.rejectReason && <> · 사유 <b>{x.rejectReason}</b></>}
          </div>
          {x.docPaths.length > 0 && (
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              {docs[i].map((u, k) => u
                ? <a key={k} href={u} target="_blank" rel="noreferrer" title="증빙 사진(10분 뒤 만료)"><img src={u} alt={`증빙 ${k + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} /></a>
                : <span key={k} className="tag m">사진을 열 수 없어요</span>)}
            </div>
          )}
          <ExpertActions userId={x.userId} status={x.status} displayName={x.displayName} />
        </div>
      ))}
    </>
  );
}
