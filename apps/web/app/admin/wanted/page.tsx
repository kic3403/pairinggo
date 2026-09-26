/**
 * 어드민 — 없는 술 요청(2026-09-20): 사용자가 찾았는데 없던 이름, 식당 메뉴판에 있던 술, 회원픽 글의 술을 한곳에.
 * 규칙은 shared `buildWantedList`(카탈로그에 있는 이름·음식·잡음 제외, 메뉴판 3 · 회원픽 2 · 검색 1로 무게).
 */
import { DRINK_REQUEST_STATUS_LABEL, wantedLinks } from "@pairinggo/shared";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog";
import { adminDrinkRequests } from "@/lib/drink-requests";
import { wantedDrinks } from "@/lib/wanted";
import RequestActions from "./RequestActions";

export const dynamic = "force-dynamic";
const kst = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : "-");

export default async function AdminWanted({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const view = (await searchParams).view === "all" ? "all" : "open";
  const [{ rows, since, counts }, requests, c] = await Promise.all([wantedDrinks(), adminDrinkRequests(view), getCatalog()]);
  const drinkNames = c.dataset.drinks.map((d) => ({ id: d.id, name: d.name }));
  return (
    <>
      {/* 회원 요청(docs/25 §5) — 검색·라벨로 못 찾아 직접 요청한 것. 등록됨으로 표시하면 요청자 마이페이지에 "등록됨 · 술 이름"으로 보인다 */}
      <h2 style={{ margin: "0 0 8px" }}>회원 요청 <span className="muted">{view === "open" ? `열림 ${requests.length}건` : `최근 ${requests.length}건`}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        검색 결과가 없거나 라벨 사진으로도 못 찾아 회원이 직접 낸 요청입니다. 술을 카탈로그에 넣은 뒤 <b>등록됨</b>(술 이름 선택)으로 표시하면 요청한 회원의 마이페이지에 알려집니다. 넣지 않을 것은 <b>보류</b>(사유는 요청자에게 보임).
        {" "}{view === "open" ? <Link href="/admin/wanted?view=all">처리한 것까지 보기</Link> : <Link href="/admin/wanted">열린 요청만</Link>}
      </p>
      <div className="card" style={{ marginBottom: 18 }}>
        {requests.length === 0 ? <p className="muted" style={{ margin: 0 }}>{view === "open" ? "열린 요청이 없어요." : "요청이 없어요."}</p> : (
          <table className="t">
            <thead><tr><th>요청한 이름</th><th>메모</th><th>누가</th><th>경로</th><th>시각</th><th>상태</th><th></th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.query}</b><div className="small"><a href={wantedLinks(r.query).naver} target="_blank" rel="noreferrer">네이버</a> · <a href={wantedLinks(r.query).thesool} target="_blank" rel="noreferrer">더술닷컴</a></div></td>
                  <td className="small" style={{ maxWidth: 260 }}>{r.memo || <span className="muted">-</span>}</td>
                  <td className="small">{r.nick ?? <span className="muted">비회원</span>}</td>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{r.source === "label" ? <span className="tag w">라벨 사진</span> : <span className="tag m">검색</span>}</td>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>{kst(r.at)}</td>
                  <td className="small">{DRINK_REQUEST_STATUS_LABEL[r.status]}{r.drinkName ? ` · ${r.drinkName}` : ""}{r.adminNote ? ` · ${r.adminNote}` : ""}</td>
                  <td style={{ whiteSpace: "nowrap" }}><RequestActions id={r.id} status={r.status} drinks={drinkNames} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 style={{ margin: "0 0 8px" }}>없는 술 요청 <span className="muted">{rows.length}개</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        최근 90일({kst(since)}부터) 모은 이름입니다 — 회원 요청 {counts.request}건 · 결과가 없던 검색어(라벨 사진 포함) {counts.search}건 · 식당 메뉴판·확인 정보의 술 {counts.menu}건 · 회원픽 글의 술 {counts.pick}건.
        카탈로그에 이미 있는 술, 음식 이름, “막걸리·추천” 같은 일반 낱말은 뺐습니다. <b>식당이 실제로 파는 술</b>을 가장 위로 올립니다.
        넣을 술을 고르면 <code>packages/db/research/additions/</code>에 적고 <code>add-drinks --apply</code>로 넣으세요.
      </p>
      {rows.length === 0 ? (
        <div className="card muted">아직 모인 이름이 없어요. 검색 로그와 파트너 메뉴판이 쌓이면 여기에 나옵니다.</div>
      ) : (
        <table className="t">
          <thead>
            <tr><th style={{ width: 34 }}>#</th><th>이름</th><th style={{ width: 210 }}>어디서</th><th style={{ width: 92 }}>마지막</th><th style={{ width: 210 }}>찾아보기</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const l = wantedLinks(r.name);
              return (
                <tr key={r.name}>
                  <td className="muted">{i + 1}</td>
                  <td><b>{r.name}</b>{r.places.length > 0 && <div className="muted small">{r.places.join(" · ")}</div>}</td>
                  <td className="small">
                    {r.by.request > 0 && <span className="tag v">요청 {r.by.request}</span>}{" "}
                    {r.by.menu > 0 && <span className="tag w">메뉴판 {r.by.menu}</span>}{" "}
                    {r.by.pick > 0 && <span className="tag">회원픽 {r.by.pick}</span>}{" "}
                    {r.by.search > 0 && <span className="tag m">검색 {r.by.search}</span>}
                  </td>
                  <td className="small muted">{kst(r.lastAt)}</td>
                  <td className="small">
                    <a href={l.thesool} target="_blank" rel="noreferrer">더술닷컴</a> · <a href={l.yosool} target="_blank" rel="noreferrer">요즘이술</a> · <a href={l.naver} target="_blank" rel="noreferrer">네이버</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
