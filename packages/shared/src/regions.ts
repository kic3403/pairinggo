/**
 * 관심지역 정의 (순수 데이터·함수, React 의존 없음).
 * 상태 저장(localStorage 스토어)은 apps/miniapp/src/lib/prefs.ts 에서 한다.
 */

export type Region = {
  id: string; label: string;
  /** 시트 표시용 긴 이름 (예: 수도권 전체 (서울/경기/인천)) */
  full?: string;
  /** 상위 지역 id — 수도권 세부 지역만 가짐 */
  parent?: string;
  /** 데이터의 region 필드 접두어 (예: 수도권 → 서울/경기/인천, 강남 → 서울 강남) */
  pre: string[];
  /** 세부 지역에 등록된 술이 없을 때 대신 보여줄 접두어 (예: 강남 → 서울) */
  fb?: string[];
  /** 지도 검색에 붙일 지역어 */
  q: string;
  /** 지역 대표 좌표 */
  lat: number; lng: number;
  /** 반경(m) — 동 단위 3.5km, 광역시 15km, 도 단위는 넓게 */
  radius: number;
};

export const REGIONS: Region[] = [
  { id: "all", label: "전국", pre: [], q: "", lat: 36.5, lng: 127.8, radius: 50000 },
  { id: "cap", label: "수도권", full: "수도권 전체 (서울/경기/인천)", pre: ["서울", "경기", "인천"], q: "서울", lat: 37.5665, lng: 126.978, radius: 30000 },
  { id: "busan", label: "부산", pre: ["부산"], q: "부산", lat: 35.1796, lng: 129.0756, radius: 15000 },
  { id: "jeju", label: "제주", pre: ["제주"], q: "제주", lat: 33.4996, lng: 126.5312, radius: 30000 },
  { id: "ulsan", label: "울산", pre: ["울산"], q: "울산", lat: 35.5384, lng: 129.3114, radius: 15000 },
  { id: "gn", label: "경남", pre: ["경남"], q: "경남", lat: 35.2383, lng: 128.6921, radius: 50000 },
  { id: "daegu", label: "대구", pre: ["대구"], q: "대구", lat: 35.8714, lng: 128.6014, radius: 15000 },
  { id: "gb", label: "경북", pre: ["경북"], q: "경북", lat: 36.4919, lng: 128.8889, radius: 50000 },
  { id: "gw", label: "강원", pre: ["강원"], q: "강원", lat: 37.8228, lng: 128.1555, radius: 50000 },
  { id: "dj", label: "대전", pre: ["대전"], q: "대전", lat: 36.3504, lng: 127.3845, radius: 15000 },
  { id: "cc", label: "충남/충북", pre: ["충남", "충북"], q: "충청도", lat: 36.6357, lng: 127.4913, radius: 50000 },
  { id: "sj", label: "세종", pre: ["세종"], q: "세종", lat: 36.48, lng: 127.289, radius: 15000 },
  { id: "jj", label: "전남/전북", pre: ["전남", "전북"], q: "전라도", lat: 35.4, lng: 127.0, radius: 50000 },
  /* ---- 수도권 세부 : parent='cap', fb = 술이 없을 때 대신 보여줄 상위 접두어 ---- */
  { id: "seoul", parent: "cap", label: "서울 전체", pre: ["서울"], q: "서울", lat: 37.5665, lng: 126.978, radius: 12000 },
  { id: "gangnam", parent: "cap", label: "강남", pre: ["서울 강남"], fb: ["서울"], q: "강남", lat: 37.4979, lng: 127.0276, radius: 3500 },
  { id: "seocho", parent: "cap", label: "서초", pre: ["서울 서초"], fb: ["서울"], q: "서초", lat: 37.4837, lng: 127.0324, radius: 3500 },
  { id: "jamsil", parent: "cap", label: "잠실/송파/강동", pre: ["서울 송파", "서울 잠실", "서울 강동"], fb: ["서울"], q: "잠실", lat: 37.5145, lng: 127.1059, radius: 5000 },
  { id: "ydp", parent: "cap", label: "영등포/여의도/강서", pre: ["서울 영등포", "서울 여의도", "서울 강서"], fb: ["서울"], q: "영등포", lat: 37.5264, lng: 126.8963, radius: 6000 },
  { id: "seongsu", parent: "cap", label: "건대/성수/왕십리", pre: ["서울 성수", "서울 광진", "서울 성동", "서울 건대"], fb: ["서울"], q: "성수", lat: 37.5445, lng: 127.056, radius: 4000 },
  { id: "jongno", parent: "cap", label: "종로/중구", pre: ["서울 종로", "서울 중구", "서울 을지로"], fb: ["서울"], q: "종로", lat: 37.5704, lng: 126.9922, radius: 3500 },
  { id: "hongdae", parent: "cap", label: "홍대/합정/마포", pre: ["서울 마포", "서울 홍대", "서울 합정", "서울 연남"], fb: ["서울"], q: "홍대", lat: 37.5563, lng: 126.9236, radius: 3500 },
  { id: "yongsan", parent: "cap", label: "용산/이태원/한남", pre: ["서울 용산", "서울 이태원", "서울 한남"], fb: ["서울"], q: "이태원", lat: 37.534, lng: 126.9948, radius: 3500 },
  { id: "seongbuk", parent: "cap", label: "성북/노원/중랑", pre: ["서울 성북", "서울 노원", "서울 중랑", "서울 도봉", "서울 강북", "서울 동대문"], fb: ["서울"], q: "노원", lat: 37.6176, lng: 127.0577, radius: 6000 },
  { id: "guro", parent: "cap", label: "구로/관악/동작", pre: ["서울 구로", "서울 관악", "서울 동작", "서울 금천"], fb: ["서울"], q: "관악", lat: 37.485, lng: 126.92, radius: 6000 },
  { id: "gg", parent: "cap", label: "경기 전체", pre: ["경기"], q: "경기", lat: 37.4138, lng: 127.5183, radius: 40000 },
  { id: "ggn", parent: "cap", label: "경기북부", pre: ["경기 파주", "경기 포천", "경기 고양", "경기 의정부", "경기 양주", "경기 남양주", "경기 구리", "경기 가평", "경기 연천", "경기 동두천", "경기 김포"], fb: ["경기"], q: "경기북부", lat: 37.75, lng: 127.05, radius: 25000 },
  { id: "anyang", parent: "cap", label: "의왕/안양/군포", pre: ["경기 의왕", "경기 안양", "경기 군포", "경기 과천"], fb: ["경기"], q: "안양", lat: 37.3943, lng: 126.9568, radius: 6000 },
  { id: "yongin", parent: "cap", label: "용인/화성/평택", pre: ["경기 용인", "경기 화성", "경기 평택", "경기 오산", "경기 안성"], fb: ["경기"], q: "용인", lat: 37.2, lng: 127.1, radius: 20000 },
  { id: "bucheon", parent: "cap", label: "부천/시흥/안산", pre: ["경기 부천", "경기 시흥", "경기 안산", "경기 광명"], fb: ["경기"], q: "부천", lat: 37.4, lng: 126.8, radius: 12000 },
  { id: "seongnam", parent: "cap", label: "성남/하남", pre: ["경기 성남", "경기 하남", "경기 광주"], fb: ["경기"], q: "성남", lat: 37.42, lng: 127.15, radius: 8000 },
  { id: "suwon", parent: "cap", label: "수원", pre: ["경기 수원"], fb: ["경기"], q: "수원", lat: 37.2636, lng: 127.0286, radius: 6000 },
  { id: "incheon", parent: "cap", label: "인천", pre: ["인천"], q: "인천", lat: 37.4563, lng: 126.7052, radius: 15000 },
];

export const RBY: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const TOP_REGIONS = REGIONS.filter((r) => !r.parent);
/** 상위 지역의 하위 트리(칩 2단) — 수도권은 서울·인천·경기도 셋. 다른 상위 지역은 하위 없음 */
export const REGION_TREE: Record<string, { id: string; label: string }[]> = {
  cap: [{ id: "seoul", label: "서울" }, { id: "incheon", label: "인천" }, { id: "gg", label: "경기도" }],
};
/** 화면 이름 — 트리에 짧은 이름이 있으면 그것(서울·인천·경기도), 없으면 label */
export const regionLabel = (r: Region) => Object.values(REGION_TREE).flat().find((s) => s.id === r.id)?.label ?? r.label;
/** 칩·선택 상자에서 쓰는 상위 id — 세부 지역이면 그 부모 */
export const topOf = (r: Region | null) => (r ? (r.parent ?? r.id) : "all");
/**
 * 수도권 안의 2단계(서울·인천·경기도) — 세부 지역(강남, 경기북부…)은 접두어로 판별한다.
 * 데이터 구조는 평평(모두 parent=cap)하지만 화면은 수도권 › 서울 › 강남 세 단계로 보여 준다.
 */
export function level2Of(r: Region | null): Region | null {
  if (!r || r.parent !== "cap") return null;
  if (REGION_TREE.cap.some((s) => s.id === r.id)) return r;
  const head = (r.pre[0] || "").split(" ")[0];
  const l2 = REGION_TREE.cap.find((s) => RBY[s.id].pre[0] === head);
  return l2 ? RBY[l2.id] : null;
}
/** 2단계 지역의 세부(3단계) 목록 — 서울 › 강남·서초·…, 경기도 › 경기북부·수원·… 인천은 없음 */
export const childrenOf = (l2: Region | null): Region[] => (l2 ? subRegions("cap").filter((r) => r.id !== l2.id && r.fb?.[0] === l2.pre[0]) : []);
/** 지역 id → Region. "all"·모르는 id는 null(= 전국) */
export const regionById = (id?: string | null): Region | null => (id && id !== "all" && RBY[id]) || null;
/** 술이 이 지역 것인지 — 데이터 region 필드가 접두어(서울/경기/…)로 시작하면. 세부 지역에 술이 없을 때의 대체(fb)는 drinksInRegion이 처리 */
export const drinkInRegion = (d: { region?: string | null }, r: Region | null) => !r || r.pre.length === 0 || r.pre.some((p) => (d.region || "").startsWith(p));
export const subRegions = (id: string) => REGIONS.filter((r) => r.parent === id);
export const fullLabel = (r: Region) => (r.parent ? `${RBY[r.parent].label} · ${r.label}` : r.full || r.label);

const distKm = (a: number, b: number, c: number, d: number) => {
  const t = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** 좌표 → 관심지역 추정 (대략적인 경계상자, 수도권은 가장 가까운 세부 지역) */
export function estimateRegion(lat: number, lng: number): string | null {
  const inb = (a: number, b: number, c: number, d: number) => lat >= a && lat <= b && lng >= c && lng <= d;
  if (lat < 34.1) return "jeju";
  if (inb(35.0, 35.4, 128.75, 129.35)) return "busan";
  if (inb(35.35, 35.75, 128.95, 129.5)) return "ulsan";
  if (inb(35.6, 36.05, 128.35, 128.8)) return "daegu";
  if (inb(36.2, 36.5, 127.25, 127.55)) return "dj";
  if (inb(36.45, 36.75, 127.1, 127.4)) return "sj";
  if (inb(37.0, 38.0, 126.3, 127.7)) {
    let best: { d: number; id: string } | null = null;
    for (const r of subRegions("cap")) {
      if (r.id === "seoul" || r.id === "gg") continue;
      const d = distKm(lat, lng, r.lat, r.lng);
      if (d <= (r.radius / 1000) * 1.3 && (!best || d < best.d)) best = { d, id: r.id };
    }
    return best ? best.id : "cap";
  }
  if (lat >= 37.0 && lng > 127.7) return "gw";
  if (inb(36.0, 37.2, 126.0, 128.2)) return "cc";
  if (inb(35.5, 37.2, 128.0, 129.7)) return "gb";
  if (inb(34.5, 35.9, 127.6, 129.4)) return "gn";
  if (inb(34.1, 36.1, 125.9, 127.7)) return "jj";
  return null;
}
