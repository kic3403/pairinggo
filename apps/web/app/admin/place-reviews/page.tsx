/** 어드민 — 식당 리뷰(2026-09-19): 신고 3건이면 자동 숨김 → 여기서 복구·삭제. 기본은 신고·숨김만, ?view=all 전체 */
import Link from "next/link";
import { REVIEW_VERIFY_LABEL } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import { adminReviews } from "@/lib/reviews";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

export default async function AdminPlaceReviews({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const view = (await searchParams).view === "all" ? "all" : "reported";
  const rows = await adminReviews(view);
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>식당 리뷰 <span className="muted">{view === "all" ? `최근 ${rows.length}개` : `신고·숨김 ${rows.length}개`}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        방문 인증(예약 방문·영수증) 리뷰만 올라와요. 신고가 3건 쌓이면 자동으로 숨겨지고 여기서 검토합니다 — 문제없으면 <b>복구</b>(신고 기록도 비움), 욕설·광고·허위·개인정보 노출이면 <b>삭제</b>.
        매장이 권리 침해(명예훼손 등)를 주장하면 먼저 <b>숨김</b>(임시조치, 최대 30일)하고 작성자에게 소명 기회를 준 뒤 정합니다.
        {" "}{view === "all" ? <Link href="/admin/place-reviews">신고·숨김만 보기</Link> : <Link href="/admin/place-reviews?view=all">전체 보기</Link>}
      </p>
      {rows.length === 0 ? <div className="card muted">{view === "all" ? "아직 리뷰가 없어요." : "신고된 리뷰가 없어요."}</div> : rows.map((r) => (
        <div className="card" key={r.id} style={r.status === "hidden" ? { borderColor: "var(--bad, #c0392b)" } : undefined}>
          <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <b style={{ fontSize: 15 }}><Link href={`/places/${r.kakaoId}?n=${encodeURIComponent(r.placeName)}`} target="_blank">{r.placeName}</Link> · {"★".repeat(r.rating)}</b>
            <span className="tag">{r.status === "hidden" ? "숨김" : "공개"}{r.reportCount ? ` · 신고 ${r.reportCount}` : ""} · {REVIEW_VERIFY_LABEL[r.verify]}</span>
          </div>
          <div style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.body}</div>
          {r.photos.length ? <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>{r.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 8 }} /></a>)}</div> : null}
          <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            {r.nickname}{r.userEmail ? ` (${r.userEmail})` : ""} · 방문 {r.visitDate} · 작성 {kst(r.createdAt)}
            {r.hiddenReason ? ` · ${r.hiddenReason}` : ""}
            {r.reasons.length ? <div>신고 사유: {r.reasons.join(" / ")}</div> : null}
          </div>
          <ReviewActions id={r.id} status={r.status} />
        </div>
      ))}
    </>
  );
}
