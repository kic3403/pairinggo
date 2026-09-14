/**
 * 음식 대분류 — 데이터의 category(한식·구이·전·… 17개)를 화면용 큰 묶음으로(2026-09-14 사용자 결정: 한식·양식·중식·일식 먼저, 그 밑에 소분류).
 * 데이터는 그대로 두고 여기서만 묶는다. 새 category가 생기면 이 표에 넣지 않으면 '기타'로 간다.
 */
export const FOOD_GROUPS: { key: string; categories: string[] }[] = [
  { key: "한식", categories: ["한식", "구이", "전", "해산물", "회", "분식", "면", "무침"] },
  { key: "양식", categories: ["양식"] },
  { key: "중식", categories: ["중식"] },
  { key: "일식", categories: ["일식"] },
  { key: "아시아", categories: ["아시아"] },
  { key: "안주·간식", categories: ["안주", "마른안주", "튀김", "치킨"] },
  { key: "디저트", categories: ["디저트"] },
];
export const FOOD_GROUP_OTHER = "기타";

const GROUP_OF = new Map(FOOD_GROUPS.flatMap((g) => g.categories.map((c) => [c, g.key] as const)));
/** category → 대분류 이름. 표에 없으면 '기타' */
export const foodGroupOf = (category: string | null | undefined) => GROUP_OF.get(category ?? "") ?? FOOD_GROUP_OTHER;

/** 한국어 이름순(가나다) 정렬 비교 — 숫자·영문이 섞여도 자연스럽게 */
export const byKoName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, "ko", { numeric: true });
