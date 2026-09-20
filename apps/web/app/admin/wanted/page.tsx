/**
 * 어드민 — 없는 술 요청(2026-09-20): 사용자가 찾았는데 없던 이름, 식당 메뉴판에 있던 술, 회원픽 글의 술을 한곳에.
 * 규칙은 shared `buildWantedList`(카탈로그에 있는 이름·음식·잡음 제외, 메뉴판 3 · 회원픽 2 · 검색 1로 무게).
 */
import { wantedLinks } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import { wantedDrinks } from "@/lib/wanted";

export const dynamic = "force-dynamic";
const kst = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : "-");

export default async function AdminWanted() {
  await requireAdmin();
  const { rows, since, counts } = await wantedDrinks();
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>없는 술 요청 <span className="muted">{rows.length}개</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        최근 90일({kst(since)}부터) 모은 이름입니다 — 결과가 없던 검색어 {counts.search}건 · 식당 메뉴판·확인 정보의 술 {counts.menu}건 · 회원픽 글의 술 {counts.pick}건.
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
