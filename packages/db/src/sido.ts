/**
 * 시도(광역) 정규화 — 엑셀 시트 순서는 사용자 지정: 서울 → 경기 → 인천 → 충남 → 세종 → 충북 → 대전 → 강원 → 전북 → 전남·광주 → 경북 → 대구 → 경남 → 울산 → 부산 → 제주
 * 광주광역시는 2026-07-01 전남광주통합특별시로 통합돼 전남에 묶는다. 대구·경북 통합은 아직 미출범이라 별도.
 */
export type Sido = "서울" | "경기" | "인천" | "충남" | "세종" | "충북" | "대전" | "강원" | "전북" | "전남" | "경북" | "대구" | "경남" | "울산" | "부산" | "제주" | "미상";
export const SIDO_ORDER: Sido[] = ["서울", "경기", "인천", "충남", "세종", "충북", "대전", "강원", "전북", "전남", "경북", "대구", "경남", "울산", "부산", "제주", "미상"];
export const SIDO_LABEL: Record<Sido, string> = {
  서울: "서울특별시", 경기: "경기도", 인천: "인천광역시", 충남: "충청남도", 세종: "세종특별자치시", 충북: "충청북도", 대전: "대전광역시", 강원: "강원특별자치도",
  전북: "전북특별자치도", 전남: "전남광주통합특별시 (전남·광주)", 경북: "경상북도", 대구: "대구광역시", 경남: "경상남도", 울산: "울산광역시", 부산: "부산광역시", 제주: "제주특별자치도", 미상: "지역 미상(확인 필요)",
};
const PREFIX: [RegExp, Sido][] = [
  [/^서울/, "서울"], [/^(경기|결기)/, "경기"], [/^인천/, "인천"], [/^(충청남도|충남)/, "충남"], [/^세종/, "세종"], [/^(충청북도|충북)/, "충북"], [/^대전/, "대전"], [/^강원/, "강원"],
  [/^(전라북도|전북)/, "전북"], [/^(전라남도|전남|광주)/, "전남"], [/^(경상북도|경북)/, "경북"], [/^대구/, "대구"], [/^(경상남도|경남)/, "경남"], [/^울산/, "울산"], [/^부산/, "부산"], [/^제주/, "제주"],
];
// 시도 없이 시군구로 시작하는 주소 보정
const CITY_ONLY: Record<string, Sido> = { 담양군: "전남", 전주시: "전북", 고창군: "전북", 김해시: "경남", 평창군: "강원", 순창군: "전북", 정읍시: "전북", 남원시: "전북", 청주시: "충북", 충주시: "충북", 영동군: "충북", 예산군: "충남", 당진시: "충남", 서천군: "충남", 홍성군: "충남", 문경시: "경북", 안동시: "경북", 김천시: "경북", 영천시: "경북", 영덕군: "경북", 여주시: "경기", 용인시: "경기", 포천시: "경기", 파주시: "경기" };
const cleanAddr = (a: string) => a.replace(/^\(?\d{5}\)?\s*/, "").replace(/^대한민국\s*/, "").replace(/^청남도/, "충청남도").replace(/^(농업회사법인|주식회사|\(주\)|㈜)\s*\S*\s*/, "").trim();

/** 주소 문자열 → 시도 */
export function sidoOf(addr: string): Sido {
  const a = cleanAddr(addr || "");
  for (const [re, s] of PREFIX) if (re.test(a)) return s;
  const first = a.split(/\s+/)[0] || "";
  if (CITY_ONLY[first]) return CITY_ONLY[first];
  for (const [city, s] of Object.entries(CITY_ONLY)) if (a.includes(city)) return s;
  return "미상";
}
/** 주소 문자열 → 시군구 ("청주시 청원구", "성동구", "울주군") */
export function sigunguOf(addr: string): string {
  const toks = cleanAddr(addr || "").replace(/,/g, " ").split(/\s+/);
  const isSido = (t: string) => PREFIX.some(([re]) => re.test(t)) && /(시|도|광주)$/.test(t);
  const rest = isSido(toks[0]) ? toks.slice(1) : toks;
  const a = rest[0] || "", b = rest[1] || "";
  if (/(시|군|구)$/.test(a)) return /시$/.test(a) && /(구|군)$/.test(b) ? `${a} ${b}` : a;
  if (/^(읍|면|동)$|(읍|면|동)$/.test(a) && a.length >= 2) return a; // 세종처럼 시군구가 없는 곳은 읍면동
  return "";
}
/** 앱 카탈로그의 region("울산 울주", "서울 성수", "경기") → 시도 */
export function sidoOfCatalogRegion(region: string): Sido {
  for (const [re, s] of PREFIX) if (re.test(region || "")) return s;
  return "미상";
}
export const sidoIndex = (s: Sido) => SIDO_ORDER.indexOf(s);
