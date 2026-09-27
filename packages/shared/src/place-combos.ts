/**
 * 이 조합을 파는 식당(2026-09-27, docs/26 D7) — 확인된 매장 정보(place_info: 운영자 확인·승인 파트너)에서
 * 한 매장이 그 술과 그 음식을 함께 판다면 페어링 카드에 "함께 파는 곳 N곳"으로 보여 준다.
 * "어울린다"는 근거는 아니다(점수·등급에 넣지 않는다) — 실제로 같이 팔리는 맥락을 보여 줄 뿐.
 *   · 술: 매장이 고른 카탈로그 술(id) 또는 술 표·술 이름 칸의 이름이 카탈로그 술 이름을 담을 때(3자 이상 — 짧은 이름은 흔한 말에 섞인다)
 *   · 음식: 매장이 고른 카탈로그 음식(id) 또는 메뉴 이름이 카탈로그 음식 이름을 담을 때(식당 맛집 순위 place-match와 같은 규칙)
 *   · 공개 카탈로그에 있는 조합만(추정 상한으로 숨긴 조합은 세지 않는다)
 */
import type { PlaceInfo } from "./place-info";
import { menuHasName } from "./place-match";

export type ComboPlaceInput = { id: string; name: string; info: PlaceInfo };
export type ComboPlace = { id: string; name: string };

const DRINK_NAME_MIN = 3;

/** 매장 한 곳이 파는 카탈로그 술·음식 id */
export function soldItems(info: PlaceInfo, drinks: { id: string; name: string }[], foods: { id: string; name: string }[]): { drinks: Set<string>; foods: Set<string> } {
  const drinkTexts = [...(info.drinkNames ?? []), ...(info.drinkItems ?? []).map((d) => d.name)].filter(Boolean);
  const menuTexts = [...(info.menuNames ?? []), ...(info.menuItems ?? []).filter((m) => !m.section || m.section === "food").map((m) => m.name)].filter(Boolean);
  const ds = new Set(info.drinks ?? []), fs = new Set(info.foods ?? []);
  if (drinkTexts.length) for (const d of drinks) if (d.name.replace(/\s+/g, "").length >= DRINK_NAME_MIN && drinkTexts.some((x) => menuHasName(x, [d.name]))) ds.add(d.id);
  if (menuTexts.length) for (const f of foods) if (menuTexts.some((x) => menuHasName(x, [f.name]))) fs.add(f.id);
  return { drinks: ds, foods: fs };
}

/** "술id|음식id" → 함께 파는 매장(이름순). pairs = 공개 카탈로그 조합 */
export function comboPlaceIndex(places: ComboPlaceInput[], catalog: { drinks: { id: string; name: string }[]; foods: { id: string; name: string }[]; pairs: Set<string> }): Map<string, ComboPlace[]> {
  const out = new Map<string, ComboPlace[]>();
  for (const p of places) {
    const s = soldItems(p.info, catalog.drinks, catalog.foods);
    if (!s.drinks.size || !s.foods.size) continue;
    for (const d of s.drinks) for (const f of s.foods) {
      const key = `${d}|${f}`;
      if (!catalog.pairs.has(key)) continue;
      const arr = out.get(key) ?? [];
      if (!arr.some((x) => x.id === p.id)) arr.push({ id: p.id, name: p.name });
      out.set(key, arr);
    }
  }
  for (const arr of out.values()) arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return out;
}

/** 카드 한 줄 — "함께 파는 곳 · 유록" / "함께 파는 곳 3곳 · 유록 외 2" */
export function comboPlaceLabel(list: ComboPlace[]): string {
  if (!list.length) return "";
  return list.length === 1 ? `함께 파는 곳 · ${list[0].name}` : `함께 파는 곳 ${list.length}곳 · ${list[0].name} 외 ${list.length - 1}`;
}
