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

export type Drink = {
  id: string; name: string; alias: string; category: string; abv: number | null;
  region: string; brewery: string; desc: string; flavor: string[];
  blog_anju: number; awards?: string[]; generic?: boolean;
  trend?: Trend; profile?: DrinkProfile;
  buy: { url: string | null; store: string | null };
  offline?: { visit: boolean | null; place: string | null; address: string | null; phone: string | null; note: string | null };
  /** 제품 사진 — 사용 허락을 받은 것만 (양조장 제공·직접 촬영). 없으면 화면은 카테고리 색 타일로 대체 */
  image?: { url: string; credit?: string | null } | null;
};

export type Food = {
  id: string; name: string; category: string; tags: string[];
  trend?: Trend; alias?: string[]; profile?: FoodProfile; new?: boolean;
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
};

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
