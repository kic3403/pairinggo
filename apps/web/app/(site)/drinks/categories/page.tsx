/**
 * 카테고리 전체 보기(2026-09-24, 요구사항 §2) — 왼쪽 주종(전통주·위스키·사케·와인) / 오른쪽 그 주종 전체 보기 + 세부 종류(수).
 * 메인 목록과 같은 분류 정의(shared catalog/kinds.ts)와 같은 필터 상태(URL의 공통 조건)를 쓴다 — 링크가 가격·용량·음식 조건을 그대로 들고 간다.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DRINK_KINDS, KIND_LABEL, filterHref, inSubtype, kindOf, parseFilter, switchKind, type DrinkKind } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 600;
type Q = Record<string, string | string[] | undefined>;
export const metadata: Metadata = { title: "술 카테고리 — 전통주·위스키·사케·와인 | 페어링GO", alternates: { canonical: "/drinks/categories" } };

export default async function Categories({ searchParams }: { searchParams: Promise<Q> }) {
  const c = await getCatalog();
  const f = parseFilter(await searchParams);
  const kind: DrinkKind = f.kind ?? "trad";
  const def = DRINK_KINDS.find((k) => k.id === kind)!;
  const inKind = c.dataset.drinks.filter((d) => kindOf(d) === kind);
  const count = (id: string) => inKind.filter((d) => inSubtype(d, id)).length;
  const kindCount = (k: DrinkKind) => c.dataset.drinks.filter((d) => kindOf(d) === k).length;
  const hrefKind = (k: DrinkKind) => `/drinks/categories${filterHref(switchKind(f, k)).replace(/^\/drinks/, "")}`;
  const hrefList = (cat: string | null) => filterHref({ ...switchKind(f, kind), cat });

  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link> · <Link href="/drinks">술</Link></p>
      <h1>카테고리 전체 보기</h1>
      <p className="lead">주종을 고르면 오른쪽에 세부 종류가 보입니다. 고른 가격·용량·음식 조건은 그대로 이어집니다.</p>
      <div className="catv">
        <ul className="catv-left" role="tablist" aria-label="주종">
          {DRINK_KINDS.map((k) => (
            <li key={k.id}><Link href={hrefKind(k.id)} role="tab" aria-selected={k.id === kind} className={k.id === kind ? "on" : undefined} scroll={false}>{k.label}<span className="n">{kindCount(k.id)}</span></Link></li>
          ))}
        </ul>
        <div className="catv-right" role="tabpanel">
          <Link href={hrefList(null)} className="catv-row strong">{def.label} 전체 보기<span className="n">{inKind.length}</span></Link>
          {inKind.length === 0 && <p className="small muted" style={{ padding: "6px 18px" }}>{def.label}은 확인된 제품 정보가 들어오는 대로 열립니다.</p>}
          {def.subtypes.map((s) => (
            <div key={s.id}>
              <Link href={hrefList(s.id)} className="catv-row">{s.label}<span className="n">{count(s.id)}</span></Link>
              {s.children?.map((ch) => <Link key={ch.id} href={hrefList(ch.id)} className="catv-row sub">{ch.label}<span className="n">{count(ch.id)}</span></Link>)}
            </div>
          ))}
          {kind === "whisky" && <p className="small muted" style={{ padding: "8px 18px 0" }}>아이리시·재패니즈·캐나디안은 종류가 아니라 생산지입니다 — 목록의 [전체 필터] › 국가·지역에서 고르세요.</p>}
          {kind === "wine" && <p className="small muted" style={{ padding: "8px 18px 0" }}>내추럴은 스타일 조건([전체 필터] › 와인 상세 조건)입니다. 스파클링·주정강화·디저트는 색상과 별개로 걸립니다.</p>}
          {kind === "sake" && <p className="small muted" style={{ padding: "8px 18px 0" }}>나마·니고리·기모토 같은 제조 특징은 [전체 필터] › 사케 상세 조건에서 특정명칭과 함께 고릅니다.</p>}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 16 }}>{KIND_LABEL[kind]} 목록으로 돌아가려면 위 링크를 누르세요.</p>
    </div>
  );
}
