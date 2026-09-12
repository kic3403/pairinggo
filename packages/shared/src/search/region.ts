/**
 * "부산 전통주", "경기 막걸리", "양평 양조장"처럼 지역 + (술 종류) 로 검색하면 그 지역의 술을 전부 낸다.
 * 지역어는 시도 이름(별칭 포함)이나 데이터 region 필드의 시군구 단어(양평·금정·정읍…)를 받는다.
 * 술 종류 단어는 카테고리로 거르고, "전통주·술·양조장·우리술"은 그냥 지나간다. 그 밖의 단어가 남으면 지역 검색이 아니다.
 */
import type { Drink } from "../types";

/** 시도 이름·별칭 → 데이터 region 접두어 */
const SIDO: Record<string, string[]> = {
  서울: ["서울"], 서울시: ["서울"], 서울특별시: ["서울"],
  경기: ["경기"], 경기도: ["경기"],
  인천: ["인천"], 인천시: ["인천"],
  수도권: ["서울", "경기", "인천"],
  부산: ["부산"], 부산시: ["부산"],
  대구: ["대구"], 울산: ["울산"], 대전: ["대전"], 세종: ["세종"], 세종시: ["세종"],
  경남: ["경남"], 경상남도: ["경남"], 경북: ["경북"], 경상북도: ["경북"], 경상도: ["경남", "경북"],
  충남: ["충남"], 충청남도: ["충남"], 충북: ["충북"], 충청북도: ["충북"], 충청도: ["충남", "충북"], 충청: ["충남", "충북"],
  전남: ["전남"], 전라남도: ["전남"], 전북: ["전북"], 전라북도: ["전북"], 전북특별자치도: ["전북"], 전라도: ["전남", "전북"], 전라: ["전남", "전북"],
  광주: ["전남 광주", "광주"],     // 2026-07 전남광주통합 — 데이터는 "전남 광주"
  강원: ["강원"], 강원도: ["강원"], 강원특별자치도: ["강원"],
  제주: ["제주"], 제주도: ["제주"], 제주특별자치도: ["제주"],
  영남: ["경남", "경북", "부산", "대구", "울산"], 호남: ["전남", "전북"], 충청권: ["충남", "충북", "대전", "세종"],
};
/** 술 종류 단어 → 카테고리 */
const CATEGORY: Record<string, string[]> = {
  막걸리: ["탁주"], 탁주: ["탁주"], 생막걸리: ["탁주"],
  약주: ["약주"], 청주: ["청주"], 약청주: ["약주", "청주"],
  소주: ["증류주"], 증류주: ["증류주"], 증류식소주: ["증류주"],
  리큐르: ["리큐르"], 과실주: ["과실주"], 와인: ["과실주", "허니와인"], 브랜디: ["브랜디"], 허니와인: ["허니와인"], 꿀술: ["허니와인"],
};
/** 있어도 뜻이 안 바뀌는 단어 */
const FILLER = new Set(["전통주", "술", "양조장", "우리술", "지역술", "추천", "종류", "목록", "리스트", "전체", "지역"]);

export type RegionQuery = {
  /** 화면 제목용 지역 이름 (검색어에 적힌 그대로) */
  label: string;
  /** 거르는 방식 — 시도 접두어 또는 시군구 단어 포함 */
  match: { pre: string[] } | { contains: string };
  category: string[] | null;
  categoryLabel: string | null;
  drinks: Drink[];
  breweries: { name: string; region: string; count: number }[];
};

const strip = (t: string) => t.replace(/[의에서은는이가을를도로]$/, "");   // "부산의", "경기도에서"

export function parseRegionQuery(q: string, drinks: Drink[]): RegionQuery | null {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 4) return null;
  let region: RegionQuery["match"] | null = null, label = "", category: string[] | null = null, categoryLabel: string | null = null;
  // 데이터에 있는 시군구 단어(두 번째 토큰) — 양평·금정·정읍…
  const towns = new Set<string>();
  for (const d of drinks) { const w = (d.region || "").split(/\s+/)[1]; if (w) towns.add(w); }

  for (const raw of tokens) {
    // 원형을 먼저 본다 — "충청도"의 '도'는 조사가 아니다. 안 맞으면 조사를 뗀 형태("부산의" → 부산)
    const t = SIDO[raw] || towns.has(raw) || CATEGORY[raw] || FILLER.has(raw) ? raw : strip(raw);
    if (!region && SIDO[t]) { region = { pre: SIDO[t] }; label = t; continue; }
    if (!region && towns.has(t)) { region = { contains: t }; label = t; continue; }
    if (!category && CATEGORY[t]) { category = CATEGORY[t]; categoryLabel = t; continue; }
    if (FILLER.has(t)) continue;
    return null;   // 지역·종류·채움말이 아닌 단어 → 일반 검색에 맡긴다
  }
  if (!region) return null;
  // 지역만 적었을 때("부산")는 둘러보기가 이미 처리하므로, 지역 + 무언가일 때만 지역 검색으로 본다
  if (tokens.length === 1) return null;

  const m = region;
  let list = drinks.filter((d) => ("pre" in m ? m.pre.some((p) => (d.region || "").startsWith(p)) : (d.region || "").includes(m.contains)));
  if (category) list = list.filter((d) => category!.includes(d.category));
  list = [...list].sort((a, b) => (a.region || "").localeCompare(b.region || "", "ko") || (a.brewery || "").localeCompare(b.brewery || "", "ko") || a.name.localeCompare(b.name, "ko"));
  const bm = new Map<string, { name: string; region: string; count: number }>();
  for (const d of list) { if (!d.brewery) continue; const v = bm.get(d.brewery) || { name: d.brewery, region: d.region || "", count: 0 }; v.count++; bm.set(d.brewery, v); }
  return { label, match: region, category, categoryLabel, drinks: list, breweries: [...bm.values()] };
}
