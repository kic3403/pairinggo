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
};

/** 음식 이름 → 카카오 키워드. 검색이 안 되거나 엉뚱한 곳이 나오는 이름만 예외로 */
export const PLACE_KEYWORD: Record<string, string> = {
  홍어삼합: "홍어", 치즈플래터: "와인바", 육포: "전통주 안주", 감바스: "스페인 요리", 다크초콜릿: "초콜릿 카페", "케이크·타르트": "케이크",
  "제철 과일": "과일 디저트", "구운 견과": "안주 술집", 팝콘: "펍", 부각: "한정식", 곶감: "전통 찻집", 약과: "전통 디저트",
  "먹태·마른오징어": "먹태 호프", 어란: "한정식", 미나리초무침: "미나리 삼겹살", 나물무침: "한정식", 겉절이: "보쌈", 새우장: "간장게장",
  "크림 파스타": "파스타", "연어 스테이크": "연어 요리", 월남쌈: "베트남 음식", 명란구이: "이자카야", 계란말이: "이자카야",
  소시지야채볶음: "호프", 닭꼬치: "이자카야", 닭똥집: "호프", 감자튀김: "펍", 문어숙회: "문어 요리", 생굴: "굴 요리", 멍게: "해산물 포차",
  산낙지: "낙지 요리", 과메기: "과메기", 굴비: "굴비 정식", 회무침: "회 무침", 물회: "물회", 육전: "육전", 순대: "순대국",
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
