/** 어드민 — 술 정보 목록(2026-09-24): 주종 탭, 규격·가격 없는 술 수, 줄마다 편집 링크. 규격·가격은 확인된 값만 넣는다(0원·0mL 금지). */
import Link from "next/link";
import { KIND_IDS, KIND_LABEL, countryLabel, subtypeLabel, type DrinkKind } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import { listDrinksAdmin } from "@/lib/admin-drinks";

export const dynamic = "force-dynamic";
type Q = { kind?: string; missing?: string; q?: string };

export default async function AdminDrinks({ searchParams }: { searchParams: Promise<Q> }) {
  await requireAdmin();
  const sp = await searchParams;
  const kind = (KIND_IDS as string[]).includes(sp.kind ?? "") ? (sp.kind as DrinkKind) : "all";
  const rowsAll = await listDrinksAdmin("all");
  const q = (sp.q ?? "").trim();
  let rows = rowsAll.filter((r) => kind === "all" || r.kind === kind);
  if (sp.missing === "spec") rows = rows.filter((r) => r.specs === 0);
  if (sp.missing === "price") rows = rows.filter((r) => r.prices === 0);
  if (q) rows = rows.filter((r) => r.name.includes(q) || r.id === q);
  const href = (p: Partial<Q>) => { const u = new URLSearchParams(); const m = { kind: sp.kind, missing: sp.missing, q: sp.q, ...p }; for (const [k, v] of Object.entries(m)) if (v) u.set(k, v); const s = u.toString(); return `/admin/drinks${s ? `?${s}` : ""}`; };
  const n = (k: DrinkKind | "all") => rowsAll.filter((r) => k === "all" || r.kind === k).length;
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>술 정보 <span className="muted">{rows.length}종 표시 · 전체 {rowsAll.length}종(데모 {rowsAll.filter((r) => r.demo).length})</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>주종·세부 종류·국가·원어명·별칭·주종별 속성과 <b>판매 규격(용량·빈티지)·참고가격(출처·확인일)</b>을 적습니다. 확인된 값만 — 가격·용량을 모르면 비워 두면 화면에 “정보 없음”으로 보입니다. 저장하면 바로 발행됩니다.
        엑셀로 한꺼번에 넣으려면 <code>pnpm --filter @pairinggo/db specs-import 파일.xlsx</code>(템플릿 ‘규격·가격’ 시트).</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {(["all", ...KIND_IDS] as (DrinkKind | "all")[]).map((k) => <Link key={k} className={`btn sm${kind === k ? " p" : ""}`} href={href({ kind: k === "all" ? undefined : k })}>{k === "all" ? "전체" : KIND_LABEL[k]} {n(k)}</Link>)}
        <span className="muted">|</span>
        <Link className={`btn sm${sp.missing === "spec" ? " p" : ""}`} href={href({ missing: sp.missing === "spec" ? undefined : "spec" })}>규격 없음 {rowsAll.filter((r) => (kind === "all" || r.kind === kind) && r.specs === 0).length}</Link>
        <Link className={`btn sm${sp.missing === "price" ? " p" : ""}`} href={href({ missing: sp.missing === "price" ? undefined : "price" })}>가격 없음 {rowsAll.filter((r) => (kind === "all" || r.kind === kind) && r.prices === 0).length}</Link>
        <form action="/admin/drinks" style={{ display: "inline-flex", gap: 6, marginLeft: "auto" }}>
          {sp.kind && <input type="hidden" name="kind" value={sp.kind} />}
          <input name="q" defaultValue={q} placeholder="이름 또는 id" style={{ width: 160 }} /><button className="btn sm" type="submit">찾기</button>
        </form>
      </div>
      <div className="card">
        <table className="t">
          <thead><tr><th>id</th><th>이름</th><th>주종</th><th>세부 종류</th><th>국가</th><th>규격</th><th>유효 가격</th><th></th></tr></thead>
          <tbody>
            {rows.slice(0, 400).map((r) => (
              <tr key={r.id}>
                <td><code>{r.id}</code></td>
                <td>{r.name}{r.demo && <span className="tag w" style={{ marginLeft: 6 }}>데모</span>}</td>
                <td>{KIND_LABEL[r.kind]}</td>
                <td>{subtypeLabel({ kind: r.kind, category: r.category })}</td>
                <td>{countryLabel(r.kind, r.country)}</td>
                <td style={{ textAlign: "right" }}>{r.specs || <span className="muted">없음</span>}</td>
                <td style={{ textAlign: "right" }}>{r.prices || <span className="muted">없음</span>}</td>
                <td><Link className="btn sm" href={`/admin/drinks/${r.id}`}>편집</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 400 && <p className="muted">앞 400종만 표시 — 이름으로 찾아 주세요.</p>}
      </div>
    </>
  );
}
