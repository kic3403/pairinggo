/**
 * 이 조합을 파는 식당 색인(2026-09-27, docs/26 D7) — 규칙은 shared place-combos.ts, 여기는 매장 정보 읽기와 10분 캐시.
 * 술·음식 상세의 페어링 카드가 "함께 파는 곳"을 붙인다. DB가 없거나 실패하면 빈 색인(카드는 그대로).
 */
import { comboPlaceIndex, type ComboPlace } from "@pairinggo/shared";
import { getCatalog } from "./catalog";
import { publicPlaceInfos } from "./place-info";

const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; version: string; index: Map<string, ComboPlace[]> } | null = null;

export async function comboPlaces(): Promise<Map<string, ComboPlace[]>> {
  const c = await getCatalog();
  if (cached && cached.version === c.version && Date.now() - cached.at < TTL_MS) return cached.index;
  try {
    const places = await publicPlaceInfos();
    const index = comboPlaceIndex(places, {
      drinks: c.dataset.drinks, foods: c.dataset.foods,
      pairs: new Set(c.dataset.pairings.map((p) => `${p.d}|${p.f}`)),
    });
    cached = { at: Date.now(), version: c.version, index };
    return index;
  } catch (e) {
    console.warn("[combo-places]", (e as Error).message);
    return new Map();
  }
}
