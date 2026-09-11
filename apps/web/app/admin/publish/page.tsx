import { requireAdmin } from "@/lib/admin-auth";
import { dashboard, listSnapshots } from "@/lib/admin-data";
import PublishButton from "./PublishButton";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  await requireAdmin();
  const [d, snaps] = await Promise.all([dashboard(), listSnapshots(10)]);
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>발행</h2>
      <div className="card">
        <p>현재 카탈로그 버전 <code>{d.version.slice(0, 19)}</code>{d.publishedAt && <span className="muted"> · {new Date(d.publishedAt).toLocaleString("ko-KR")}</span>}</p>
        <p>발행 후 승격된 후보 <b>{d.promotedAfter}</b>건 · 전체 페어링 {d.totalPairings}건</p>
        <p className="muted">발행하면 <b>스냅샷을 먼저 저장하고</b> 버전을 올립니다. 미니앱은 다음 시작 때 새 카탈로그를 받아 갈아끼웁니다(재검수 불필요). 보류(pending) 페어링은 포함되지 않습니다.</p>
        <PublishButton />
      </div>

      <h3 style={{ margin: "18px 0 8px" }}>발행 이력 <span className="muted">최근 {snaps.length}건</span></h3>
      <div className="card">
        {snaps.length === 0 ? (
          <p className="muted">아직 발행 이력이 없습니다.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "4px 6px" }}>버전</th><th style={{ padding: "4px 6px" }}>페어링</th><th style={{ padding: "4px 6px" }}>메모</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => {
                const live = s.version === d.version;
                return (
                  <tr key={s.version} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px" }}>
                      {live && <span className="tag" style={{ marginRight: 6 }}>현재</span>}
                      <code>{s.version.slice(0, 19)}</code>
                    </td>
                    <td style={{ padding: "6px" }}>{s.counts?.pairings ?? "-"}</td>
                    <td style={{ padding: "6px" }} className="muted">{s.note || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ marginTop: 10 }}>
          잘못 발행했다면 되돌릴 수 있습니다. 터미널에서 <code>pnpm db:rollback</code>으로 이력을 보고,
          <code>pnpm db:rollback &lt;버전&gt;</code>으로 무엇이 바뀌는지 확인한 뒤 <code>--apply</code>를 붙여 적용하세요.
          되돌려도 페어링을 지우지 않고 보류로 내리므로 근거와 검수 이력은 남습니다.
        </p>
      </div>
    </>
  );
}
