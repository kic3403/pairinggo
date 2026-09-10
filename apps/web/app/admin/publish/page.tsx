import { requireAdmin } from "@/lib/admin-auth";
import { dashboard } from "@/lib/admin-data";
import PublishButton from "./PublishButton";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  await requireAdmin();
  const d = await dashboard();
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>발행</h2>
      <div className="card">
        <p>현재 카탈로그 버전 <code>{d.version.slice(0, 19)}</code>{d.publishedAt && <span className="muted"> · {new Date(d.publishedAt).toLocaleString("ko-KR")}</span>}</p>
        <p>발행 후 승격된 후보 <b>{d.promotedAfter}</b>건 · 전체 페어링 {d.totalPairings}건</p>
        <p className="muted">발행하면 버전이 올라가고 스냅샷이 저장됩니다. 미니앱은 다음 시작 때 새 카탈로그를 받아 갈아끼웁니다(재검수 불필요). 보류(pending) 페어링은 포함되지 않습니다.</p>
        <PublishButton />
      </div>
    </>
  );
}
