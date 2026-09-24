/**
 * 주종별 전문 정보(2026-09-24, 요구사항 §13 ⑤) — drinks.attrs를 catalog/kinds.ts 정의(show: true)의 라벨로 풀어 보여 준다.
 * 값이 없는 항목은 아예 내지 않는다(미확인을 지어내지 않는다). NAS·NV처럼 '없음'이 정보인 항목은 bool로 적혀 있을 때만.
 */
import { KIND_BY_ID, KIND_LABEL, countryLabel, kindOf, subtypeLabel, type AttrDef, type Drink } from "@pairinggo/shared";

function fmt(a: AttrDef, v: unknown): string | null {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
  const opt = (id: unknown) => a.options?.find((o) => o.id === String(id))?.label ?? String(id);
  switch (a.type) {
    case "bool": return v === true ? "예" : v === false ? "아니요" : null;
    case "multi": case "tags": return (Array.isArray(v) ? v : [v]).map(opt).join(", ");
    case "select": return opt(v);
    case "int": case "level": return a.key === "age" ? `${v}년` : a.key === "polish" ? `${v}%` : a.key === "vintage" ? String(v) : String(v);
    default: return String(v);
  }
}

export default function KindFacts({ drink }: { drink: Drink }) {
  const kind = kindOf(drink);
  const def = KIND_BY_ID[kind];
  const rows: { k: string; v: string }[] = [];
  if (kind !== "trad") {
    rows.push({ k: "주종", v: `${KIND_LABEL[kind]} · ${subtypeLabel(drink)}` });
    rows.push({ k: "생산 국가", v: countryLabel(kind, drink.country) });
    if (drink.brewery) rows.push({ k: kind === "whisky" ? "병입·생산자" : kind === "sake" ? "양조장" : "생산자", v: drink.brewery });
  }
  for (const a of def.attrs) {
    if (!a.show || a.type === "level") continue;
    const v = fmt(a, drink.attrs?.[a.key]);
    if (v) rows.push({ k: a.label, v });
  }
  // 위스키: 연수 없음(NAS)·와인 NV는 짝 항목이 참일 때 '없음' 대신 표시가 되므로 int 항목은 숨긴다
  if (!rows.length) return null;
  return (
    <section className="facts">
      <h2>{kind === "trad" ? "제품 정보" : `${KIND_LABEL[kind]} 정보`}</h2>
      <dl className="kv facts-kv">{rows.map((r) => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl>
    </section>
  );
}
