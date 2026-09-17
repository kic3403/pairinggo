/**
 * 추천 점수 검증(2026-09-17) — "이 점수가 실제 근거 조합을 얼마나 골라내는가"를 한 숫자(AUC)로 잰다.
 * 0.5 = 무작위, 1 = 완벽. 음성은 근거 조합의 술·음식을 서로 바꿔 짝지은 것 — 인기 술·인기 음식이라 점수가 높은 효과를 뺀다.
 * 음성은 "확인 안 된 조합"일 뿐 나쁜 조합이 아니어서(좋은 조합도 섞여 있다) 1에 가까워질 수 없다. 규칙끼리 비교하는 자다.
 */
export type EvalPair = { d: string; f: string };

/** 양성 점수가 음성 점수보다 높을 확률(동점은 0.5) */
export function auc(pos: number[], neg: number[]): number {
  if (!pos.length || !neg.length) return 0.5;
  const s = [...neg].sort((a, b) => a - b);
  const bound = (x: number, strict: boolean) => { let lo = 0, hi = s.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (strict ? s[mid] < x : s[mid] <= x) lo = mid + 1; else hi = mid; } return lo; };
  let wins = 0;
  for (const x of pos) { const below = bound(x, true), upTo = bound(x, false); wins += below + (upTo - below) / 2; }
  return wins / (pos.length * neg.length);
}

/** 근거 조합 vs 서로 바꿔 짝지은 조합. known: 음성에서 뺄 조합("d|f") — 교차검증에서는 다른 겹의 근거 조합까지 넣는다 */
export function shuffledAuc(pos: EvalPair[], score: (d: string, f: string) => number, known: Set<string> = new Set(pos.map((p) => `${p.d}|${p.f}`))): number {
  const ps = pos.map((p) => score(p.d, p.f));
  const ns: number[] = [];
  for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) if (i !== j && !known.has(`${pos[i].d}|${pos[j].f}`)) ns.push(score(pos[i].d, pos[j].f));
  return auc(ps, ns);
}

/**
 * 술(또는 음식) 단위로 K겹으로 나눠, 나머지 겹으로 만든 점수 함수를 빼 둔 겹에서 잰 AUC 평균.
 * fit(train) → score 함수. 배우지 않는 규칙이면 train을 무시하면 된다.
 */
export function crossValidatedAuc(pos: EvalPair[], fit: (train: EvalPair[]) => (d: string, f: string) => number, by: "d" | "f" = "d", folds = 5): number {
  const groups = [...new Set(pos.map((p) => p[by]))].sort();
  const known = new Set(pos.map((p) => `${p.d}|${p.f}`));
  let total = 0, used = 0;
  for (let k = 0; k < folds; k++) {
    const held = new Set(groups.filter((_, i) => i % folds === k));
    const train = pos.filter((p) => !held.has(p[by])), test = pos.filter((p) => held.has(p[by]));
    if (test.length < 2) continue;
    total += shuffledAuc(test, fit(train), known); used++;
  }
  return used ? total / used : 0.5;
}
