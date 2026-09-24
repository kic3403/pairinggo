/**
 * 주종·세부 종류·국가·주종별 속성 정의(2026-09-24) — 화면 표시명과 DB 식별자를 여기서만 잇는다.
 *  · DB `drinks.kind` = trad | whisky | sake | wine. '전체'는 조회 범위(kind 없음)이지 저장값이 아니다.
 *  · DB `drinks.category` = 세부 종류 식별자(전통주는 기존 값 그대로: 탁주·약주·청주·증류주·과실주·리큐르·브랜디·허니와인,
 *    새 주종은 아래 `categories`의 첫 값). URL은 `Subtype.id`(영문). 표시명은 `label`.
 *  · 주종별 속성은 `drinks.attrs`(jsonb)에 `AttrDef.key`로 둔다. 필터에 쓰는 속성은 `filter: true`.
 *  · 위스키 생산지 '아이리시'·'재패니즈'는 종류가 아니라 국가 조건(ireland·japan)이다. '뉴월드'는 저장값이 아니다.
 *  · 사케 특정명칭(category)과 제조 특징(attrs.styles[])은 따로 — "준마이 긴조 + 나마 + 니고리"가 된다. 일본식 소주는 다루지 않는다.
 *  · 와인은 색상(category)·탄산·스킨컨택·주정강화·단맛·스타일을 나눠 두고, 빠른 탐색(스파클링·주정강화·디저트)은 속성으로 판정한다.
 */
import type { Drink, DrinkKind } from "../types";

export const KIND_IDS: DrinkKind[] = ["trad", "whisky", "sake", "wine"];
export const KIND_LABEL: Record<DrinkKind, string> = { trad: "전통주", whisky: "위스키", sake: "사케", wine: "와인" };

export type Subtype = {
  id: string; label: string;
  /** 이 세부 종류에 속하는 DB category 값들(첫 값이 새로 넣을 때의 저장값) */
  categories: string[];
  /** 세부 필터(그레인 → 싱글그레인·블렌디드 그레인, 기타 → 싱글팟스틸·콘) */
  children?: { id: string; label: string; categories: string[] }[];
  /** 검색 동의어(정규화 전) */
  match?: string[];
  /** category 대신 속성으로 판정(와인 스파클링·주정강화·디저트) */
  attr?: { key: string; value: unknown };
};
export type CountryDef = { id: string; label: string; match?: string[] };
export type AttrOption = { id: string; label: string; match?: string[] };
export type AttrBand = { id: string; label: string; min?: number; max?: number; nullOnly?: boolean };
export type AttrDef = {
  key: string; label: string;
  /** select 하나 · multi 여러 개(배열) · bool · int(구간 bands) · text · tags(자유 목록) · level(맛 프로필 1~5, drink.profile[key]) */
  type: "select" | "multi" | "bool" | "int" | "text" | "tags" | "level";
  options?: AttrOption[];
  bands?: AttrBand[];
  /** 필터 패널에 보이는 속성 */
  filter?: boolean;
  /** 상세 화면 '주종별 전문 정보'에 보이는 속성 */
  show?: boolean;
  /** 이 속성이 붙는 짝(int + nas 처럼) */
  hint?: string;
};
export type KindDef = {
  id: DrinkKind; label: string;
  /** 검색 동의어 */
  match: string[];
  subtypes: Subtype[];
  /** 세부 칩 첫 줄에 보이는 개수(나머지는 더보기) */
  firstRow: number;
  countries: CountryDef[];
  attrs: AttrDef[];
  /** 지역 칩(관심지역) 사용 — 전통주만 */
  regionChips?: boolean;
};

const LEVEL_BANDS: AttrBand[] = [{ id: "low", label: "약함", min: 1, max: 2 }, { id: "mid", label: "보통", min: 3, max: 3 }, { id: "high", label: "강함", min: 4, max: 5 }];
const level = (key: string, label: string): AttrDef => ({ key, label, type: "level", bands: LEVEL_BANDS, filter: true });

export const DRINK_KINDS: KindDef[] = [
  {
    id: "trad", label: "전통주", match: ["전통주", "우리술", "국산술"], firstRow: 6, regionChips: true,
    subtypes: [
      { id: "makgeolli", label: "막걸리·탁주", categories: ["탁주"], match: ["막걸리", "탁주", "동동주"] },
      { id: "yakju", label: "약주", categories: ["약주"] },
      { id: "cheongju", label: "청주", categories: ["청주"], match: ["정종"] },
      { id: "distilled", label: "증류주", categories: ["증류주"], match: ["소주", "증류식소주", "안동소주"] },
      { id: "fruit", label: "과실주", categories: ["과실주"], match: ["과일주", "복분자주", "사과주"] },
      { id: "liqueur", label: "리큐르·기타", categories: ["리큐르", "브랜디", "허니와인"], match: ["리큐어", "담금주", "미드", "벌꿀술"] },
    ],
    countries: [{ id: "kr", label: "한국" }],
    attrs: [
      { key: "ingredient", label: "원료", type: "tags", filter: true, show: true },
      level("sweet", "단맛"), level("acid", "산미"), level("body", "바디감"), level("fizz", "탄산"),
      { key: "aged", label: "숙성", type: "bool", filter: true, show: true },
    ],
  },
  {
    id: "whisky", label: "위스키", match: ["위스키", "whisky", "whiskey", "위스끼", "몰트"], firstRow: 7,
    subtypes: [
      { id: "single_malt", label: "싱글몰트", categories: ["싱글몰트"], match: ["싱글 몰트", "single malt"] },
      { id: "blended_malt", label: "블렌디드 몰트", categories: ["블렌디드 몰트"], match: ["blended malt"] },
      { id: "blended", label: "블렌디드", categories: ["블렌디드"], match: ["blended"] },
      { id: "grain", label: "그레인", categories: ["싱글그레인", "블렌디드 그레인", "그레인"], match: ["grain"], children: [
        { id: "single_grain", label: "싱글그레인", categories: ["싱글그레인"] },
        { id: "blended_grain", label: "블렌디드 그레인", categories: ["블렌디드 그레인"] },
      ] },
      { id: "bourbon", label: "버번", categories: ["버번"], match: ["bourbon"] },
      { id: "rye", label: "라이", categories: ["라이"], match: ["rye"] },
      { id: "other", label: "기타", categories: ["싱글팟스틸", "콘 위스키", "기타 위스키"], children: [
        { id: "single_pot_still", label: "싱글팟스틸", categories: ["싱글팟스틸"] },
        { id: "corn", label: "콘 위스키", categories: ["콘 위스키"] },
        { id: "other_confirmed", label: "기타 확인된 종류", categories: ["기타 위스키"] },
      ] },
    ],
    countries: [
      { id: "scotland", label: "스코틀랜드", match: ["스카치", "scotch"] }, { id: "ireland", label: "아일랜드", match: ["아이리시", "irish"] },
      { id: "usa", label: "미국", match: ["아메리칸", "american"] }, { id: "japan", label: "일본", match: ["재패니즈", "japanese"] },
      { id: "canada", label: "캐나다", match: ["캐나디안", "canadian"] }, { id: "taiwan", label: "대만" }, { id: "india", label: "인도" },
      { id: "korea", label: "한국" }, { id: "other", label: "기타 생산지" },
    ],
    attrs: [
      { key: "sub_region", label: "세부 생산 지역", type: "text", filter: true, show: true },
      { key: "distillery", label: "증류소", type: "text", filter: true, show: true },
      { key: "age", label: "숙성 연수", type: "int", filter: true, show: true, hint: "nas", bands: [
        { id: "nas", label: "NAS(연수 미표기)", nullOnly: true }, { id: "u10", label: "10년 미만", min: 1, max: 9 }, { id: "10-15", label: "10~15년", min: 10, max: 15 },
        { id: "16-20", label: "16~20년", min: 16, max: 20 }, { id: "21", label: "21년 이상", min: 21 },
      ] },
      { key: "nas", label: "NAS", type: "bool", show: true },
      { key: "peat", label: "피트·스모키", type: "select", filter: true, show: true, options: [{ id: "none", label: "없음" }, { id: "light", label: "약함" }, { id: "medium", label: "중간" }, { id: "heavy", label: "강함" }] },
      { key: "cask", label: "캐스크 종류", type: "multi", filter: true, show: true, options: [
        { id: "bourbon", label: "버번" }, { id: "sherry", label: "셰리" }, { id: "port", label: "포트" }, { id: "wine", label: "와인" }, { id: "rum", label: "럼" }, { id: "mizunara", label: "미즈나라" }, { id: "virgin_oak", label: "버진 오크" }, { id: "other", label: "기타" },
      ] },
      { key: "finish", label: "캐스크 숙성 / 피니시", type: "text", show: true },
      { key: "cask_strength", label: "캐스크 스트렝스", type: "bool", filter: true, show: true },
      { key: "single_cask", label: "싱글캐스크", type: "bool", filter: true, show: true },
      { key: "independent_bottling", label: "독립 병입", type: "bool", filter: true, show: true },
      { key: "serve", label: "음용 방식", type: "multi", filter: true, show: true, options: [{ id: "neat", label: "니트" }, { id: "rocks", label: "온더록스" }, { id: "highball", label: "하이볼" }] },
    ],
  },
  {
    id: "sake", label: "사케", match: ["사케", "sake", "니혼슈", "일본술", "일본청주"], firstRow: 4,
    subtypes: [
      { id: "junmai", label: "준마이", categories: ["준마이"], match: ["쥰마이", "junmai", "순미"] },
      { id: "ginjo", label: "긴조", categories: ["긴조"], match: ["ginjo", "음양"] },
      { id: "junmai_ginjo", label: "준마이 긴조", categories: ["준마이 긴조"], match: ["쥰마이 긴조", "junmai ginjo"] },
      { id: "daiginjo", label: "다이긴조", categories: ["다이긴조"], match: ["daiginjo", "대음양"] },
      { id: "junmai_daiginjo", label: "준마이 다이긴조", categories: ["준마이 다이긴조"], match: ["쥰마이 다이긴조", "junmai daiginjo"] },
      { id: "honjozo", label: "혼조조", categories: ["혼조조"], match: ["honjozo", "본양조"] },
      { id: "tokubetsu_junmai", label: "도쿠베츠 준마이", categories: ["도쿠베츠 준마이"], match: ["특별준마이", "tokubetsu junmai"] },
      { id: "tokubetsu_honjozo", label: "도쿠베츠 혼조조", categories: ["도쿠베츠 혼조조"], match: ["특별혼조조", "tokubetsu honjozo"] },
      { id: "futsushu", label: "후쓰슈", categories: ["후쓰슈"], match: ["후츠슈", "futsushu", "보통주"] },
    ],
    countries: [{ id: "japan", label: "일본" }],
    attrs: [
      { key: "styles", label: "제조·스타일", type: "multi", filter: true, show: true, options: [
        { id: "nama", label: "나마", match: ["생주", "namazake"] }, { id: "namachozo", label: "나마초조" }, { id: "namazume", label: "나마즈메" }, { id: "nigori", label: "니고리", match: ["탁한 사케"] },
        { id: "sparkling", label: "스파클링" }, { id: "genshu", label: "겐슈", match: ["원주"] }, { id: "muroka", label: "무로카" }, { id: "koshu", label: "고슈", match: ["숙성 사케"] },
        { id: "kimoto", label: "기모토" }, { id: "yamahai", label: "야마하이" },
      ] },
      { key: "prefecture", label: "생산 지역", type: "text", filter: true, show: true },
      { key: "rice", label: "주조미 품종", type: "text", filter: true, show: true },
      { key: "polish", label: "정미율", type: "int", filter: true, show: true, bands: [{ id: "u50", label: "50% 이하", min: 1, max: 50 }, { id: "51-60", label: "51~60%", min: 51, max: 60 }, { id: "61-70", label: "61~70%", min: 61, max: 70 }, { id: "71", label: "71% 이상", min: 71 }] },
      level("sweet", "단맛"), level("acid", "산미"), level("body", "바디감"),
      { key: "temp", label: "권장 음용 온도", type: "multi", filter: true, show: true, options: [{ id: "cold", label: "차갑게" }, { id: "room", label: "상온" }, { id: "warm", label: "따뜻하게" }, { id: "hot", label: "뜨겁게" }] },
    ],
  },
  {
    id: "wine", label: "와인", match: ["와인", "wine", "포도주"], firstRow: 7,
    subtypes: [
      { id: "red", label: "레드", categories: ["레드"], match: ["레드와인", "red wine"] },
      { id: "white", label: "화이트", categories: ["화이트"], match: ["화이트와인", "white wine"] },
      { id: "sparkling", label: "스파클링", categories: [], attr: { key: "sparkling", value: true }, match: ["스파클링와인", "sparkling", "샴페인", "champagne", "카바", "프로세코"] },
      { id: "rose", label: "로제", categories: ["로제"], match: ["로제와인", "rose", "rosé"] },
      { id: "orange", label: "오렌지", categories: ["오렌지"], match: ["오렌지와인", "orange wine"] },
      { id: "fortified", label: "주정강화", categories: [], attr: { key: "fortified", value: true }, match: ["주정강화와인", "포트", "셰리", "fortified"] },
      { id: "dessert", label: "디저트", categories: [], attr: { key: "style", value: "dessert" }, match: ["디저트와인", "dessert wine", "아이스와인"] },
    ],
    countries: [
      { id: "france", label: "프랑스" }, { id: "italy", label: "이탈리아" }, { id: "spain", label: "스페인" }, { id: "portugal", label: "포르투갈" }, { id: "germany", label: "독일" },
      { id: "usa", label: "미국" }, { id: "chile", label: "칠레" }, { id: "argentina", label: "아르헨티나" }, { id: "australia", label: "호주" }, { id: "nz", label: "뉴질랜드" },
      { id: "south_africa", label: "남아프리카공화국" }, { id: "austria", label: "오스트리아" }, { id: "georgia", label: "조지아" }, { id: "korea", label: "한국" }, { id: "other", label: "기타" },
    ],
    attrs: [
      { key: "sparkling", label: "탄산", type: "bool", show: true },
      { key: "skin_contact", label: "스킨컨택", type: "bool", show: true },
      { key: "fortified", label: "주정강화", type: "bool", show: true },
      { key: "sweetness", label: "단맛", type: "select", filter: true, show: true, options: [{ id: "dry", label: "드라이" }, { id: "off_dry", label: "오프드라이" }, { id: "sweet", label: "스위트" }] },
      { key: "style", label: "확인된 스타일", type: "select", filter: true, show: true, options: [{ id: "natural", label: "내추럴" }, { id: "dessert", label: "디저트" }, { id: "champagne", label: "샴페인" }, { id: "cava", label: "카바" }, { id: "prosecco", label: "프로세코" }, { id: "port", label: "포트" }, { id: "sherry", label: "셰리" }] },
      { key: "natural_note", label: "내추럴 관련 확인 정보", type: "text", show: true },
      { key: "organic_note", label: "유기농·바이오다이내믹 확인 정보", type: "text", show: true },
      { key: "grapes", label: "품종", type: "tags", filter: true, show: true, options: [
        { id: "cabernet_sauvignon", label: "카베르네 소비뇽", match: ["cabernet sauvignon", "까베르네"] }, { id: "merlot", label: "메를로", match: ["merlot", "멀롯"] }, { id: "pinot_noir", label: "피노 누아", match: ["pinot noir", "피노누아"] },
        { id: "syrah", label: "시라·쉬라즈", match: ["시라", "쉬라즈", "syrah", "shiraz"] }, { id: "malbec", label: "말벡", match: ["malbec"] }, { id: "sangiovese", label: "산지오베제", match: ["sangiovese"] }, { id: "nebbiolo", label: "네비올로", match: ["nebbiolo"] },
        { id: "tempranillo", label: "템프라니요", match: ["tempranillo"] }, { id: "grenache", label: "그르나슈·가르나차", match: ["그르나슈", "가르나차", "grenache", "garnacha"] }, { id: "zinfandel", label: "진판델", match: ["zinfandel"] },
        { id: "chardonnay", label: "샤르도네", match: ["chardonnay", "샤도네이"] }, { id: "sauvignon_blanc", label: "소비뇽 블랑", match: ["sauvignon blanc", "쇼비뇽"] }, { id: "riesling", label: "리슬링", match: ["riesling"] },
        { id: "chenin_blanc", label: "슈냉 블랑", match: ["chenin blanc"] }, { id: "pinot_gris", label: "피노 그리·피노 그리지오", match: ["피노 그리", "피노 그리지오", "pinot gris", "pinot grigio"] }, { id: "gewurztraminer", label: "게뷔르츠트라미너", match: ["gewurztraminer", "게부르츠"] },
        { id: "viognier", label: "비오니에", match: ["viognier"] }, { id: "albarino", label: "알바리뇨", match: ["albarino", "albariño"] }, { id: "moscato", label: "모스카토·뮈스카 계열", match: ["모스카토", "뮈스카", "moscato", "muscat"] },
      ] },
      { key: "producer", label: "생산자", type: "text", filter: true, show: true },
      { key: "region", label: "산지", type: "text", filter: true, show: true },
      { key: "vintage", label: "빈티지", type: "int", filter: true, show: true, hint: "nv", bands: [{ id: "nv", label: "NV", nullOnly: true }, { id: "2020", label: "2020년 이후", min: 2020 }, { id: "2010s", label: "2010~2019", min: 2010, max: 2019 }, { id: "old", label: "2009년 이전", max: 2009 }] },
      { key: "nv", label: "NV", type: "bool", show: true },
      level("acid", "산미"), level("body", "바디감"),
      { key: "tannin", label: "타닌", type: "int", filter: true, show: true, bands: LEVEL_BANDS },
    ],
  },
];

export const KIND_BY_ID: Record<DrinkKind, KindDef> = Object.fromEntries(DRINK_KINDS.map((k) => [k.id, k])) as Record<DrinkKind, KindDef>;
export const kindOf = (d: Pick<Drink, "kind">): DrinkKind => (d.kind && KIND_BY_ID[d.kind] ? d.kind : "trad");
export const kindLabel = (d: Pick<Drink, "kind">) => KIND_LABEL[kindOf(d)];
export const cleanKind = (v: unknown): DrinkKind => (KIND_IDS.includes(v as DrinkKind) ? (v as DrinkKind) : "trad");

/** 술의 세부 종류(탐색 상위 분류) — category로 찾고, 없으면 속성 판정(와인 스파클링 등). 여러 개일 수 있다(로제 스파클링 = 로제 + 스파클링) */
export function subtypesOf(d: Pick<Drink, "kind" | "category" | "attrs">): Subtype[] {
  const k = KIND_BY_ID[kindOf(d)];
  // category로 맞는 것(색상·특정명칭)이 앞, 속성으로 맞는 것(스파클링·주정강화·디저트)이 뒤 — 라벨은 첫 번째를 쓴다("로제" 스파클링)
  const byCat = k.subtypes.filter((s) => s.categories.includes(d.category));
  const byAttr = k.subtypes.filter((s) => !s.categories.includes(d.category) && s.attr && attrEquals(d.attrs?.[s.attr.key], s.attr.value));
  return [...byCat, ...byAttr];
}
const attrEquals = (a: unknown, b: unknown) => (typeof b === "boolean" ? !!a === b : String(a ?? "") === String(b));
/** 세부 종류 라벨(첫 번째) — 없으면 category 그대로(전통주 옛 값도 라벨과 같다), 그것도 없으면 '미확인' */
export function subtypeLabel(d: Pick<Drink, "kind" | "category" | "attrs">): string {
  const s = subtypesOf(d)[0];
  return s?.label ?? (d.category || "미확인");
}
/** 세부 종류(또는 그 자식)에 속하는가 — URL ?cat= 판정 */
export function inSubtype(d: Pick<Drink, "kind" | "category" | "attrs">, catId: string): boolean {
  const k = KIND_BY_ID[kindOf(d)];
  for (const s of k.subtypes) {
    if (s.id === catId) return s.categories.includes(d.category) || (!!s.attr && attrEquals(d.attrs?.[s.attr.key], s.attr.value));
    const c = s.children?.find((x) => x.id === catId);
    if (c) return c.categories.includes(d.category);
  }
  return false;
}
export const findSubtype = (kind: DrinkKind, id: string) => {
  for (const s of KIND_BY_ID[kind].subtypes) { if (s.id === id) return s; const c = s.children?.find((x) => x.id === id); if (c) return { ...c, parent: s }; }
  return null;
};
export const countryLabel = (kind: DrinkKind, id: string | undefined) => KIND_BY_ID[kind].countries.find((c) => c.id === (id || "kr"))?.label ?? id ?? "";
/** 새로 넣는 술의 category 저장값 — 세부 종류 id에서 */
export const categoryForSubtype = (kind: DrinkKind, id: string): string | null => findSubtype(kind, id)?.categories[0] ?? null;

/**
 * 공통 음식 필터 — 실제 등록된 페어링(byDrink)으로 판정한다. 음식은 분류(category)·태그·이름으로 묶는다.
 */
export type FoodFilterDef = { id: string; label: string; categories?: string[]; tags?: string[]; names?: string[] };
export const FOOD_FILTERS: FoodFilterDef[] = [
  { id: "grill", label: "고기구이", categories: ["구이"], tags: ["육즙"] },
  { id: "seafood", label: "회·해산물", categories: ["회", "해산물"] },
  { id: "fried", label: "튀김", categories: ["튀김", "치킨"], tags: ["바삭"] },
  { id: "spicy", label: "매운 음식", tags: ["매콤", "얼큰", "얼얼", "매콤달콤"] },
  { id: "korean", label: "전·한식", categories: ["전", "한식"] },
  { id: "cheese", label: "치즈", names: ["치즈"], tags: ["치즈"] },
  { id: "dessert", label: "디저트", categories: ["디저트"] },
];
export const foodMatchesFilter = (f: { name: string; category: string; tags: string[] }, def: FoodFilterDef) =>
  !!(def.categories?.includes(f.category) || def.tags?.some((t) => f.tags.includes(t)) || def.names?.some((n) => f.name.includes(n)));

/** 검색 동의어 → 주종/세부 종류 (정규화 전 문자열 그대로; search/normalize에서 normalize해 쓴다) */
export function kindSynonyms(): { word: string; kind: DrinkKind; cat?: string }[] {
  const out: { word: string; kind: DrinkKind; cat?: string }[] = [];
  for (const k of DRINK_KINDS) {
    for (const w of [k.label, ...k.match]) out.push({ word: w, kind: k.id });
    for (const s of k.subtypes) for (const w of [s.label, ...(s.match ?? [])]) out.push({ word: w, kind: k.id, cat: s.id });
  }
  return out;
}
