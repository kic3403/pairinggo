/**
 * 미쉐린 가이드 선정 식당 — 최근 3개 연도. 공개된 선정 사실(이름·등급·요리·가격대)과 공식 페이지 링크만 보여 준다.
 * 로고·가이드 문장·사진은 쓰지 않는다(상표·저작권). 명단 갱신은 docs/17.
 */
import type { Metadata } from "next";
import Link from "next/link";
import ExtLink from "../_components/ExtLink";
import { loadAwardYears, type AwardRow } from "@/lib/awards";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "미쉐린 가이드 서울·부산 선정 식당 — 최근 3년 | 페어링GO",
  description: "미쉐린 가이드 서울 & 부산의 스타·빕구르망 식당을 연도별로 정리했습니다. 공식 페이지로 바로 연결됩니다.",
  alternates: { canonical: "/michelin" },
};

const KIND_LABEL: Record<string, string> = { star: "스타", bib: "빕구르망", green: "그린스타", selected: "셀렉티드" };
const groupKey = (r: AwardRow) => (r.kind === "star" ? `star${r.level}` : r.kind);
const ORDER = ["star3", "star2", "star1", "bib", "green", "selected"];
const groupLabel = (k: string) => (k.startsWith("star") ? `${"★".repeat(Number(k.slice(4)))} ${k.slice(4)}스타` : KIND_LABEL[k] ?? k);

export default async function MichelinPage() {
  const years = await loadAwardYears(3);
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>미쉐린 가이드 선정 식당 <span className="muted">· 최근 3년</span></h1>
      <p className="lead">서울·부산 스타와 빕구르망 식당을 연도별로 모았습니다. 이름을 누르면 미쉐린 가이드 공식 페이지로 갑니다. 음식 상세의 주변 식당 검색에서도 같은 식당에 배지가 붙습니다.</p>
      {!years.length && <p className="muted">명단이 아직 없습니다.</p>}

      <ul className="tabs" style={{ marginTop: 14 }}>
        {years.map((y) => <li key={y.year}><a href={`#y${y.year}`}>{y.year}<span className="cnt">{y.rows.length}</span></a></li>)}
      </ul>

      {years.map((y) => {
        const cities = ["서울", "부산"];
        return (
          <section key={y.year} id={`y${y.year}`}>
            <h2>{y.edition?.edition ?? `미쉐린 가이드 서울 & 부산 ${y.year}`} <span className="muted small">{y.rows.length}곳</span></h2>
            {y.edition?.coverage && !y.edition.coverage.startsWith("전체") && (
              <p className="small muted">이 연도는 <b>일부 명단</b>입니다 — {y.edition.coverage}. 공식 명단 확인 후 채웁니다.</p>
            )}
            {cities.map((city) => {
              const rows = y.rows.filter((r) => r.city === city);
              if (!rows.length) return null;
              const groups = ORDER.map((k) => [k, rows.filter((r) => groupKey(r) === k)] as const).filter(([, v]) => v.length);
              return (
                <div key={city} className="mich-city">
                  <h3>{city} <span className="muted small">{rows.length}곳</span></h3>
                  {groups.map(([k, list]) => (
                    <div key={k} className="mich-group">
                      <div className={`mich-head ${k.startsWith("star") ? "star" : k}`}>{groupLabel(k)} <span className="muted small">{list.length}</span></div>
                      <ul className="rows">
                        {list.sort((a, b) => a.name.localeCompare(b.name, "ko")).map((r) => (
                          <li key={`${r.city}-${r.name}-${k}`} className="row">
                            <span className={`award ${r.kind}`}>{k.startsWith("star") ? "★".repeat(r.level) : KIND_LABEL[r.kind]}</span>
                            <span className="grow">
                              <b>{r.name}</b>
                              <span className="small muted">{[r.cuisine, r.price].filter(Boolean).join(" · ") || "—"}</span>
                            </span>
                            {r.url
                              ? <ExtLink href={r.url} event="external_link" props={{ kind: "michelin_guide", place: r.name, year: r.year }} className="small">가이드에서 보기 ↗</ExtLink>
                              : <ExtLink href={`https://guide.michelin.com/kr/ko/search?q=${encodeURIComponent(r.name)}`} event="external_link" props={{ kind: "michelin_search", place: r.name, year: r.year }} className="small">가이드 검색 ↗</ExtLink>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })}
            {y.edition?.source && <p className="small muted">출처: {y.edition.source}{y.edition.published ? ` · 발표 ${y.edition.published}` : ""}</p>}
          </section>
        );
      })}

      <p className="small muted" style={{ marginTop: 28 }}>
        “미쉐린 가이드”, 별 등급, 빕구르망은 Michelin의 상표입니다. 이 화면은 공개된 선정 사실을 출처와 함께 정리한 것이며 미쉐린과 제휴 관계가 없습니다. 별 표시는 자체 문자이고 공식 로고가 아닙니다.
      </p>
    </div>
  );
}
