import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/** 랜딩 (최소) — 서비스 소개 · API 상태. Phase 3에서 약관·개인정보처리방침·고객센터 페이지가 붙는다 */
export default async function Page() {
  const c = await getCatalog();
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px" }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 20 }} aria-hidden>
        <i style={{ display: "block", width: 28, height: 28, borderRadius: "50%", background: "#22406B" }} />
        <i style={{ display: "block", width: 28, height: 28, borderRadius: "50%", background: "#E4572E", marginLeft: -9, opacity: 0.92 }} />
      </div>
      <h1 style={{ fontSize: 32, margin: 0 }}>페어링<span style={{ color: "#E4572E" }}>GO</span></h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, marginTop: 12 }}>전통주를 검색하면 어울리는 음식을, 음식을 검색하면 어울리는 전통주를 — 양조장·소믈리에·전문 매체 근거와 함께. 토스 앱에서 만나요.</p>
      <table style={{ marginTop: 28, fontSize: 14, borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: "6px 16px 6px 0", color: "#8C8C88" }}>카탈로그</td><td>전통주 {c.counts.drinks} · 음식 {c.counts.foods} · 페어링 {c.counts.pairings}</td></tr>
          <tr><td style={{ padding: "6px 16px 6px 0", color: "#8C8C88" }}>버전</td><td><code>{c.version}</code> · 출처 {c.source === "db" ? "데이터베이스" : "내장 데이터"}</td></tr>
          <tr><td style={{ padding: "6px 16px 6px 0", color: "#8C8C88" }}>API</td><td><code>/api/v1/catalog</code> · <code>/api/v1/search?q=</code> · <code>/api/v1/popular</code></td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: "#8C8C88", marginTop: 40, lineHeight: 1.6 }}>지나친 음주는 뇌졸중, 기억력 손상이나 치매를 유발합니다. 임신 중 음주는 기형아 출생 위험을 높입니다. 주류는 만 19세 이상만 구매할 수 있습니다.</p>
    </main>
  );
}
