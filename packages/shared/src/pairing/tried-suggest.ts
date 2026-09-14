/**
 * 마이페이지 "먹어봤나요?" 카드 — 저장한 술·음식으로 아직 평가하지 않은 조합을 골라 바로 평가하게 한다(docs/20 P1-1).
 * 평가가 곧 성별·연령대별 선호 데이터라서, 저장만 하고 평가는 안 한 회원에게 가장 쉬운 다음 행동을 준다.
 * 규칙: 저장한 술 → 그 술의 최상위 조합, 저장한 음식 → 그 음식의 최상위 조합을 번갈아 뽑는다. 이미 평가한 조합·같은 조합 중복은 뺀다.
 */
import type { Pairing } from "../types";

export type TriedSuggestion = { d: string; f: string };

export function suggestTried(input: {
  savedDrinks: string[];
  savedFoods: string[];
  /** 이미 평가한 조합 "d|f" */
  rated: Set<string>;
  byDrink: Record<string, Pairing[]>;
  byFood: Record<string, Pairing[]>;
  /** 화면과 같은 순서로 정렬(등급 → 근거 → 점수) */
  rank: (rows: Pairing[]) => Pairing[];
}, max = 3): TriedSuggestion[] {
  const out: TriedSuggestion[] = [];
  const seen = new Set<string>(input.rated);
  const push = (p: Pairing | undefined) => {
    if (!p) return false;
    const k = `${p.d}|${p.f}`;
    if (seen.has(k)) return false;
    seen.add(k); out.push({ d: p.d, f: p.f }); return true;
  };
  // 각 저장 항목마다 후보 목록을 정렬해 두고, 술·음식을 번갈아 가며 아직 안 쓴 첫 조합을 하나씩 뽑는다
  const lanes: Pairing[][] = [];
  const dl = input.savedDrinks.map((id) => input.rank(input.byDrink[id] ?? []));
  const fl = input.savedFoods.map((id) => input.rank(input.byFood[id] ?? []));
  for (let i = 0; i < Math.max(dl.length, fl.length); i++) { if (dl[i]) lanes.push(dl[i]); if (fl[i]) lanes.push(fl[i]); }
  let progressed = true;
  while (out.length < max && progressed) {
    progressed = false;
    for (const lane of lanes) {
      if (out.length >= max) break;
      const next = lane.find((p) => !seen.has(`${p.d}|${p.f}`));
      if (push(next)) progressed = true;
    }
  }
  return out;
}
