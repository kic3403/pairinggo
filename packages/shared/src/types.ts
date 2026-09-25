/** 데이터 타입 — packages/shared/data/pairings.json 스키마 (docs/04 4-1 카탈로그와 필드 호환) */

export type Trend = {
  naver: number | null; insta: number | null; youtube: number | null; google: number | null;
  score: number; channels: number; rank?: number;
  /** 일주일 전 순위(같은 규칙으로 7일 전 기준 계산)와 변동(prev_rank − rank, +면 상승). prev_rank가 null이면 그때는 순위 밖·미집계(NEW) */
  prev_rank?: number | null; delta?: number | null;
  raw?: Record<string, number | null>;
};

/** 술 맛 프로필 1~5 */
export type DrinkProfile = { sweet: number; acid: number; body: number; fizz: number; aroma: number };
/** 음식 맛 프로필 1~5 */
export type FoodProfile = { fat: number; spice: number; umami: number; salt: number; sweet: number; weight: number };

/** 맛 프로필 계산 결과: 0~100 점수 + 긍정/부정 근거 */
export type PF = { s: number; plus: string[]; minus: string[] };

/** 주종(2026-09-24) — 전통주·위스키·사케·와인. '전체'는 조회 범위일 뿐 저장값이 아니다 */
export type DrinkKind = "trad" | "whisky" | "sake" | "wine";
/** 참고가격 한 건 — 한 병(그 규격) 기준, 배송비·쿠폰 제외. 0원·미확인은 행을 만들지 않는다 */
export type SpecPrice = {
  krw: number;
  /** msrp 권장소비자가 · retail 외부 판매처 가격 */
  type: "msrp" | "retail";
  source: string; url?: string | null;
  /** 확인일 YYYY-MM-DD */
  checked: string;
};
/** 판매 규격 — 같은 술도 용량·빈티지가 다르면 규격이 다르다. 가격·용량 필터는 규격 단위로 판정한다 */
export type DrinkSpec = {
  id: string;
  /** 용량 mL(정규화). 미확인은 null — 0은 저장하지 않는다 */
  ml: number | null;
  abv?: number | null;
  vintage?: string | null;
  /** bottle 한 병 · set 세트(bottles 병) — 기본 필터는 bottle만 */
  pack: "bottle" | "set";
  bottles: number;
  note?: string | null;
  /** 유효한 참고가격만(없으면 빈 배열 = 가격 정보 없음) */
  prices: SpecPrice[];
};

export type Drink = {
  id: string; name: string; alias: string; category: string; abv: number | null;
  region: string; brewery: string; desc: string; flavor: string[];
  blog_anju: number; awards?: string[]; generic?: boolean;
  trend?: Trend; profile?: DrinkProfile;
  buy: { url: string | null; store: string | null };
  offline?: { visit: boolean | null; place: string | null; address: string | null; phone: string | null; note: string | null };
  /** 제품 사진 — 사용 허락을 받은 것만 (양조장 제공·직접 촬영). 없으면 화면은 카테고리 색 타일로 대체 */
  image?: { url: string; credit?: string | null } | null;
  /** 주종 — 없으면 전통주(옛 데이터) */
  kind?: DrinkKind;
  /** 국가·생산지 식별자(kr·scotland·japan…; catalog/kinds.ts) — 없으면 kr */
  country?: string;
  /** 주종별 속성(위스키 증류소·숙성, 사케 제조 특징, 와인 색상·품종…) — 키는 catalog/kinds.ts 정의 */
  attrs?: Record<string, unknown>;
  /** 원어명(라벨 표기) */
  nameOrig?: string | null;
  /** 별칭 전체(검색용) — alias는 그중 첫 번째(짧은 이름) */
  aliases?: string[];
  /** 등록일(ISO) — 최신순 정렬용 */
  added?: string;
  /** 개발 데모 항목 — 공개 카탈로그에서 제외 */
  demo?: boolean;
  /** 판매 규격(용량·빈티지)과 참고가격 — 없거나 비어 있으면 용량·가격 미확인 */
  specs?: DrinkSpec[];
};

export type Food = {
  id: string; name: string; category: string; tags: string[];
  trend?: Trend; alias?: string[]; profile?: FoodProfile; new?: boolean;
  /** 음식 사진(0037) — 사용 허락을 받은 것만(직접 촬영·라이선스 확인분). 없으면 상세 머리 카드는 분류 색 타일 */
  image?: { url: string; credit?: string | null } | null;
};

/** 출처 등급: 양조장 공식 > 소믈리에·명인 > 전문 매체 > 블로그·카페 후기 > 맛 프로필 (> ai: Phase 9) */
export type SrcTier = "official" | "sommelier" | "media" | "blog" | "profile" | "ai" | "user";
export type Evidence = { source?: string | null; url?: string | null; quote?: string | null; who?: string | null };

export type Pairing = {
  d: string; f: string;
  /** 전문가 매칭점수 (84~97) */
  es: number;
  reason: string;
  /** 네이버 블로그 실측 언급량 */
  blog: number;
  src?: SrcTier; ev?: Evidence; pf?: PF;
  /** 음용 방식(위스키 니트·온더록스·하이볼, 사케 온·냉) — 방식별 추천을 나눌 때만 */
  serve?: PairingServe | null;
  /** 근거 확인일 YYYY-MM-DD */
  checked?: string | null;
};
export type PairingServe = "neat" | "rocks" | "highball" | "warm" | "cold";
export const SERVE_LABEL: Record<PairingServe, string> = { neat: "니트", rocks: "온더록스", highball: "하이볼", warm: "따뜻하게", cold: "차갑게" };

export type ProfileMeta = {
  drink_keys: Record<keyof DrinkProfile, string>;
  food_keys: Record<keyof FoodProfile, string>;
  scale: string; rule: string; band: string;
};

export type Dataset = {
  drinks: Drink[]; foods: Food[]; pairings: Pairing[];
  trend_meta?: { period: string; collected: string; note: string; compared_to?: string | null };
  src_meta?: Record<string, unknown>;
  profile_meta?: ProfileMeta;
};
