/** 어드민 — 술 평가(2026-09-26, docs/25): 최근 평가 목록, 숨기기(사유)·복구·삭제. 신고 기능은 아직 없어 운영자가 직접 본다. */
import Link from "next/link";
import { starGlyphs } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import { adminDrinkReviews } from "@/lib/drink-reviews";
import DrinkReviewActions from "./DrinkReviewActions";

export const dynamic = "force-dynamic";
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

export default async function AdminDrinkReviews({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const view = (await searchParams).view === "hidden" ? "hidden" : "all";
  const rows = await adminDrinkReviews(view);
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>술 평가 <span className="muted">{view === "hidden" ? `숨김 ${rows.length}개` : `최근 ${rows.length}개`}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        회원이 술마다 남긴 별점·한 줄(회원당 술 하나에 하나). 평균은 3명부터 화면에 보입니다. 욕설·광고·허위·개인정보 노출이면 <b>숨김</b>(사유 기록) 또는 <b>삭제</b>.
        {" "}{view === "hidden" ? <Link href="/admin/drink-reviews">전체 보기</Link> : <Link href="/admin/drink-reviews?view=hidden">숨김만 보기</Link>}
      </p>
      <div className="card">
        {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>{view === "hidden" ? "숨긴 평가가 없어요." : "아직 평가가 없어요."}</p> : (
          <table className="t">
            <thead><tr><th>술</th><th>별점</th><th>한 줄</th><th>회원</th><th>시각</th><th>상태</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={r.status === "hidden" ? { opacity: .7 } : undefined}>
                  <td><Link href={`/drinks/${encodeURIComponent(r.drinkName)}`} target="_blank">{r.drinkName}</Link></td>
                  <td style={{ whiteSpace: "nowrap", color: "#B8860B" }}>{starGlyphs(r.stars)}</td>
                  <td style={{ maxWidth: 360 }}>{r.body || <span className="muted">(없음)</span>}</td>
                  <td>{r.nick}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{kst(r.at)}</td>
                  <td>{r.status === "hidden" ? <span className="tag w">숨김{r.hiddenReason ? ` · ${r.hiddenReason}` : ""}</span> : <span className="tag">공개</span>}</td>
                  <td><DrinkReviewActions id={r.id} status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
