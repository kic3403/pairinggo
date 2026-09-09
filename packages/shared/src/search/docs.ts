/**
 * 검색 인덱스 문서 — 술 108 · 음식 110 · 둘러보기(종류·지역·양조장).
 * 모듈 로드 시 한 번 만들고, applyDataset()으로 카탈로그가 바뀌면 다시 만든다 (218+α 건, 수 ms).
 */
import { BREWERIES, CATEGORIES, DATA, onDatasetChange } from "../data";
import { choseong, toJamo } from "../hangul";
import { REGIONS } from "../regions";
import { normalize } from "./normalize";

export type DocType = "drink" | "food" | "browse";
export type BrowseKind = "category" | "region" | "brewery";

export type Doc = {
  type: DocType;
  id: string;
  /** 표시 이름 */
  name: string;
  /** 부제 (종류 · 도수 · 지역 등) */
  meta: string;
  /** browse 전용: 종류/지역/양조장 */
  kind?: BrowseKind;
  /** 라우팅 키 (browse: /browse/:kind/:key) */
  key?: string;
  /** 정규화 문자열들 */
  norm: string; jamo: string; cho: string;
  aliases: { norm: string; jamo: string }[];
  fields: { category: string; tags: string[]; region: string; brewery: string; awards: number };
  /** 트렌드 0~1 */
  trend: number;
};

function mk(type: DocType, id: string, name: string, meta: string, extra: Partial<Doc> = {}): Doc {
  const norm = normalize(name);
  return {
    type, id, name, meta,
    norm, jamo: toJamo(norm), cho: choseong(name.replace(/\s+/g, "")),
    aliases: [], fields: { category: "", tags: [], region: "", brewery: "", awards: 0 }, trend: 0,
    ...extra,
  };
}

function build(): Doc[] {
  const out: Doc[] = [];
  for (const d of DATA.drinks) {
    const aliases = [d.alias, ...(d.brewery ? [d.brewery] : [])].filter((a) => a && normalize(a) !== normalize(d.name)).map((a) => ({ norm: normalize(a), jamo: toJamo(normalize(a)) }));
    out.push(mk("drink", d.id, d.name, [d.category, d.abv != null ? `${d.abv}%` : null, d.region || d.brewery].filter(Boolean).join(" · "), {
      aliases,
      fields: { category: normalize(d.category), tags: (d.flavor || []).map(normalize), region: normalize(d.region || ""), brewery: normalize(d.brewery || ""), awards: (d.awards || []).length },
      trend: (d.trend?.score || 0) / 100,
    }));
  }
  for (const f of DATA.foods) {
    const aliases = (f.alias || []).map((a) => ({ norm: normalize(a), jamo: toJamo(normalize(a)) }));
    out.push(mk("food", f.id, f.name, `${f.category} · ${f.tags.join(" · ")}`, {
      aliases,
      fields: { category: normalize(f.category), tags: (f.tags || []).map(normalize), region: "", brewery: "", awards: 0 },
      trend: (f.trend?.score || 0) / 100,
    }));
  }
  // 둘러보기: 종류
  for (const c of CATEGORIES) out.push(mk("browse", `category:${c.key}`, c.key, `술 종류 · ${c.count}종`, { kind: "category", key: c.key, trend: 0.5 }));
  // 둘러보기: 지역 (관심지역 라벨 + 데이터 region 첫 토큰)
  const regionNames = new Set<string>();
  for (const r of REGIONS) if (r.id !== "all" && !r.parent) r.label.split("/").forEach((l) => regionNames.add(l.trim()));
  for (const d of DATA.drinks) { const t = (d.region || "").split(" "); if (t[0]) regionNames.add(t[0]); if (t[1] && t[1].length >= 2) regionNames.add(t[1]); }
  for (const name of regionNames) {
    const count = DATA.drinks.filter((d) => (d.region || "").includes(name)).length;
    if (!count) continue;
    out.push(mk("browse", `region:${name}`, name, `지역 · 우리술 ${count}종`, { kind: "region", key: name, trend: Math.min(1, count / 10) }));
  }
  // 둘러보기: 양조장
  for (const b of BREWERIES) out.push(mk("browse", `brewery:${b.name}`, b.name, `양조장 · ${b.region} · ${b.count}종`, { kind: "brewery", key: b.name, trend: Math.min(1, b.count / 4) }));
  return out;
}

export let DOCS: Doc[] = build();
export let DRINK_DOCS: Doc[] = DOCS.filter((d) => d.type === "drink");
export let FOOD_DOCS: Doc[] = DOCS.filter((d) => d.type === "food");

export function rebuildDocs() {
  DOCS = build();
  DRINK_DOCS = DOCS.filter((d) => d.type === "drink");
  FOOD_DOCS = DOCS.filter((d) => d.type === "food");
}
onDatasetChange(rebuildDocs);
