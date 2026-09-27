/**
 * 추정 조합 상한(2026-09-27, docs/26 §3-3) — 근거 없는 맛 분석 추정 조합이 음식 하나에 수백 개 몰리는 것(치즈플래터 376)을 줄인다.
 * 추정 조합만 대상: 음식마다 맛 분석(pf.s) 상위 20개, 또는 술마다 상위 5개에 들면 남기고 나머지는 숨긴다(status hidden — 삭제 아님).
 * 술마다 몇 개는 늘 남겨 근거가 없는 술도 빈 화면이 되지 않게 한다. 회원이 평가한 조합은 숨기지 않는다.
 */
export const ESTIMATE_FOOD_CAP = 20;
/** 술마다 최소 5개 — 상세 화면이 비지 않게(데이터 무결성 테스트 '술마다 페어링 5개 이상'과 같은 기준) */
export const ESTIMATE_DRINK_KEEP = 5;

export type CapRow = { id: number | string; d: string; f: string; estimate: boolean; pf: number; rated?: boolean };

export function estimateCapPlan(rows: CapRow[], foodCap = ESTIMATE_FOOD_CAP, drinkKeep = ESTIMATE_DRINK_KEEP): Set<number | string> {
  const est = rows.filter((r) => r.estimate);
  const rank = (key: (r: CapRow) => string) => {
    const by = new Map<string, CapRow[]>();
    for (const r of est) by.set(key(r), [...(by.get(key(r)) ?? []), r]);
    const out = new Map<number | string, number>();
    for (const list of by.values()) list.sort((a, b) => b.pf - a.pf || String(a.id).localeCompare(String(b.id))).forEach((r, i) => out.set(r.id, i + 1));
    return out;
  };
  const inFood = rank((r) => r.f), inDrink = rank((r) => r.d);
  const hide = new Set<number | string>();
  for (const r of est) if (!r.rated && inFood.get(r.id)! > foodCap && inDrink.get(r.id)! > drinkKeep) hide.add(r.id);
  return hide;
}
