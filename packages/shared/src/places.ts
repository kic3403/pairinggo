/**
 * 장소 검색 — 카카오 로컬 API용 검색어와 정규화된 장소 타입.
 * 데이터에 search_keyword가 없는 동안은 규칙 + 예외 사전으로 음식 이름을 "식당을 찾는 말"로 바꾼다.
 */
import type { Food } from "./types";

export type Place = {
  id: string; name: string;
  /** 카카오 category_name 마지막 토큰 (예: 육류,고기요리) */
  category: string; categoryPath: string;
  address: string; roadAddress: string; phone: string | null;
  lat: number; lng: number;
  /** 검색 중심으로부터 거리(km). 좌표 없이 검색하면 null */
  distanceKm: number | null;
  placeUrl: string | null;
  /** 수상 배지(미쉐린 등) — 서버가 restaurant_awards와 대조해 붙인다. 없으면 undefined */
  award?: import("./awards").AwardBadge | null;
  /** 구글 지도 평점 — 서버가 place_ratings 캐시·Places API로 붙인다. 없으면 undefined */
  rating?: import("./place-rating").PlaceRating | null;
  /** 구글 지도 편의 정보(주차·단체·예약) — 평점과 함께 붙는다. 정보가 없으면 undefined/null */
  amenities?: import("./place-rating").PlaceAmenities | null;
};

/** 음식 이름 → 카카오 키워드. 검색이 안 되거나 엉뚱한 곳이 나오는 이름만 예외로 */
export const PLACE_KEYWORD: Record<string, string> = {
  홍어삼합: "홍어", 치즈플래터: "와인바", 육포: "전통주 안주", 감바스: "스페인 요리", 다크초콜릿: "초콜릿 카페", "케이크·타르트": "케이크",
  "제철 과일": "과일 디저트", "구운 견과": "안주 술집", 팝콘: "펍", 부각: "한정식", 곶감: "전통 찻집", 약과: "전통 디저트",
  "먹태·마른오징어": "먹태 호프", 어란: "한정식", 미나리초무침: "미나리 삼겹살", 나물무침: "한정식", 겉절이: "보쌈", 새우장: "간장게장",
  "크림 파스타": "파스타", "연어 스테이크": "연어 요리", 월남쌈: "베트남 음식", 명란구이: "이자카야", 계란말이: "이자카야",
  소시지야채볶음: "호프", 닭꼬치: "이자카야", 닭똥집: "호프", 감자튀김: "펍", 문어숙회: "문어 요리", 생굴: "굴 요리", 멍게: "해산물 포차",
  산낙지: "낙지 요리", 과메기: "과메기", 굴비: "굴비 정식", 회무침: "회 무침", 물회: "물회", 육전: "육전", 순대: "순대국",
  /* 음식 확장(2026-09-14) — 양식·중식·일식·아시아 */
  "토마토 파스타": "파스타", "알리오 올리오": "파스타", 리조또: "리조또", 햄버거: "수제버거", "바비큐 립": "바베큐 립", 카프레제: "이탈리안",
  샤퀴테리: "와인바", 피시앤칩스: "피쉬앤칩스", 딤섬: "딤섬", 멘보샤: "중식당", 양장피: "중식당", 유린기: "중식당", 깐풍기: "중식당", 탕수육: "중식당",
  마라샹궈: "마라샹궈", 오코노미야키: "오코노미야키", 가라아게: "이자카야", 스키야키: "스키야키", 타코야키: "타코야키", 사케동: "사케동",
  텐동: "텐동", 모츠나베: "모츠나베", 똠얌꿍: "태국 음식", 팟타이: "태국 음식", 분짜: "베트남 음식", 쌀국수: "쌀국수", 카레: "커리",
};

/** 카카오 검색어: "{키워드}" — 라우트에서 뒤에 "맛집"을 붙인다 */
export function placeQuery(food: Pick<Food, "name">): string {
  return PLACE_KEYWORD[food.name] ?? food.name;
}

/** 거리 표시: 0.8km → "800m", 2.34 → "2.3km" */
export function fmtDistance(km: number | null | undefined): string {
  if (km == null) return "";
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/** 카카오맵 길찾기 링크 (이름, 위도, 경도) */
export const kakaoRouteUrl = (name: string, lat: number, lng: number) => `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
export const kakaoSearchUrl = (q: string) => `https://map.kakao.com/link/search/${encodeURIComponent(q)}`;

/* ---------- 식당 결과 관련도(2026-09-15, docs/20 P1-5) ----------
 * 카카오 키워드 검색은 "육회 맛집"에 메뉴에 육회가 있는 고깃집·한정식까지 준다. 카카오 분류(categoryPath)는 "한식 > 육류,고기"처럼 거칠어
 * 완벽히 거를 수는 없지만, 이름·분류에 음식 이름(또는 검색 키워드)이 든 곳을 앞에, 음식 계열과 다른 분류(예: 육회 검색에 국밥·카페)를 뒤로 보낸다. */
const CUISINE_TOKENS: Record<string, string[]> = {
  한식: ["한식"], 구이: ["한식", "육류", "고기"], 전: ["한식"], 해산물: ["해물", "생선", "한식", "조개", "굴"], 회: ["회", "해물", "생선", "일식", "초밥"],
  분식: ["분식", "한식"], 면: ["한식", "국수", "냉면"], 무침: ["한식"], 안주: ["술집", "호프", "한식", "요리주점"], 마른안주: ["술집", "호프", "바"],
  튀김: ["한식", "치킨", "술집"], 치킨: ["치킨", "닭"], 양식: ["양식", "이탈리안", "스테이크", "패밀리레스토랑", "햄버거", "피자", "파스타"],
  중식: ["중식", "중국"], 일식: ["일식", "돈까스", "초밥", "라멘", "우동", "일본"], 아시아: ["아시아", "베트남", "태국", "인도", "동남아", "쌀국수"], 디저트: ["카페", "디저트", "베이커리"],
};
const nz = (s: string) => s.replace(/\s+/g, "").toLowerCase();
/** 2: 이름·분류에 음식 이름이나 검색 키워드가 있음 · 1: 음식 계열 분류(한식·중식…) · 0: 그 밖(다른 계열) */
export function placeRelevance(place: { name: string; categoryPath?: string }, food: { name: string; category?: string }): 0 | 1 | 2 {
  const hay = nz(`${place.name} ${place.categoryPath ?? ""}`);
  const kw = nz(placeQuery(food));
  const fname = nz(food.name);
  // 검색 키워드가 "중식당·태국 음식·스페인 요리"처럼 업종 말이면 접미사를 뗀 핵심어("중식"·"태국"·"스페인")로도 본다
  const kwCore = kw.replace(/(전문점|요리|음식|포차|호프|카페|펍|바|당|집)$/, "");   // "중식당"→"중식"("식당"을 떼면 "중"만 남아 못 씀)
  if ((fname.length >= 2 && hay.includes(fname)) || (kw.length >= 2 && hay.includes(kw)) || (kwCore.length >= 2 && hay.includes(kwCore))) return 2;
  const tokens = CUISINE_TOKENS[food.category ?? ""] ?? [];
  if (!tokens.length) return 1;
  return tokens.some((t) => hay.includes(nz(t))) ? 1 : 0;
}
/** 관련도 높은 순, 같으면 원래 순서(평점순·거리순)를 지킨다 */
export function rankPlaces<T extends { name: string; categoryPath?: string }>(places: T[], food: { name: string; category?: string }): T[] {
  return places.map((p, i) => ({ p, i, r: placeRelevance(p, food) })).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.p);
}
