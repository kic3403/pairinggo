/**
 * 전통주 수상 — 우리술품평회(농식품부·aT)와 대한민국주류대상(조선비즈) 우리술 부문을 같은 형식으로 다룬다.
 * 카탈로그 drinks.awards는 문자열 배열: "2025 우리술품평회 과실주 대상", "2026 대한민국주류대상 탁주 Best of Best".
 * 수상 명단(packages/db/research/awards/*.json)을 카탈로그 술에 붙이는 대조 규칙도 여기 — 틀리게 붙는 것보다 못 붙는 게 낫다
 * (못 붙은 것은 `drink-awards` 미리보기에 같은 양조장 후보와 함께 나오고, 사람이 overrides에 적는다).
 */

export type DrinkCompetition = "우리술품평회" | "대한민국주류대상";
export type DrinkAward = { competition: DrinkCompetition; year: number; part: string; prize: string };

/** /awards 화면 탭 순서·설명, 다루는 연도 수 (2026-09-20 사용자 결정: 우리술품평회 5년 · 대한민국주류대상 3년) */
export const DRINK_COMPETITIONS: { key: "fair" | "kla"; name: DrinkCompetition; host: string; years: number; about: string }[] = [
  { key: "fair", name: "우리술품평회", host: "농림축산식품부·aT", years: 5, about: "농림축산식품부가 해마다 여는 국내 유일의 정부 주관 전통주 경연입니다. 부문마다 대상·최우수상·우수상을 주고, 대통령상은 그해 최고의 술 한 병에만 주어집니다." },
  { key: "kla", name: "대한민국주류대상", host: "조선비즈", years: 3, about: "조선비즈가 해마다 여는 주류 품평회로, 주류 전문가 100여 명이 주종별로 심사합니다. 우리술 부문 수상작(대상)이며, Best of Best는 그해 주종별 최고점을 받은 술입니다." },
];
export const awardYearCount = (c: DrinkCompetition) => DRINK_COMPETITIONS.find((x) => x.name === c)?.years ?? 5;
/** 기본 연도 수 */
export const AWARD_YEARS = 5;

const PRIZES = ["대상·대통령상", "대통령상", "Best of Best", "최우수상", "우수상", "장려상", "대상"] as const;
const RANK: Record<string, number> = { 대통령상: 0, "Best of Best": 0, 대상: 1, 최우수상: 2, 우수상: 3, 장려상: 4 };
export const prizeRank = (prize: string) => RANK[prize] ?? 9;

/** 부문 이름 맞추기 — "약주·청주"·"약청주" → "약·청주", "탁주부문" → "탁주" */
export function normAwardPart(part: string): string {
  const p = (part || "").replace(/부문/g, "").replace(/\s+/g, " ").trim();
  if (/^약\s*[·./,]?\s*(주)?\s*[·./,]?\s*청주$/.test(p)) return "약·청주";
  return p;
}
const normPrize = (prize: string) => (/대통령상/.test(prize) ? "대통령상" : /best\s*of\s*best/i.test(prize) ? "Best of Best" : prize.trim());

export function drinkAwardString(a: DrinkAward): string {
  return [String(a.year), a.competition, normAwardPart(a.part), normPrize(a.prize)].filter(Boolean).join(" ");
}

const AWARD_RE = /^((?:19|20)\d\d)\s*년?\s*(?:대한민국\s*)?(우리술\s*품평회|주류\s*대상)\s*(.*)$/;
export function parseDrinkAward(s: string): DrinkAward | null {
  const m = (s || "").trim().match(AWARD_RE);
  if (!m) return null;
  const competition: DrinkCompetition = /품평회/.test(m[2]) ? "우리술품평회" : "대한민국주류대상";
  const rest = m[3].replace(/\s*\(.*?\)\s*/g, " ").trim();
  const hit = PRIZES.find((p) => rest.toLowerCase().endsWith(p.toLowerCase()));
  const prize = hit ? normPrize(hit) : rest;
  const part = hit ? normAwardPart(rest.slice(0, rest.length - hit.length)) : "";
  return { competition, year: Number(m[1]), part, prize };
}

/** 가장 최근 연도부터 n개 연도 (수상주가 없는 연도도 칸을 둔다) */
export function awardYears(present: number[], n = AWARD_YEARS): number[] {
  if (!present.length) return [];
  const max = Math.max(...present);
  return Array.from({ length: n }, (_, i) => max - i);
}

/** 기존 수상 목록에 새 수상을 합친다 — 같은 대회·연도의 예전 표기는 새 표기로 바꾸고, 대회 밖 수상(해외 대회 등)은 뒤에 그대로 */
export function mergeDrinkAwards(existing: string[], add: DrinkAward[]): string[] {
  const key = (a: DrinkAward) => `${a.competition}|${a.year}`;
  const addKeys = new Set(add.map(key));
  const parsed: { s: string; year: number }[] = [];
  const other: string[] = [];
  for (const s of existing) {
    const a = parseDrinkAward(s);
    if (!a) { other.push(s); continue; }
    if (addKeys.has(key(a))) continue;
    parsed.push({ s, year: a.year });
  }
  for (const a of add) parsed.push({ s: drinkAwardString(a), year: a.year });
  const seen = new Set<string>();
  return [...parsed.sort((a, b) => b.year - a.year).map((x) => x.s), ...other].filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
}

/* ---------- 수상작 ↔ 카탈로그 술 ---------- */
export type AwardDrink = { id: string; name: string; alias?: string[] | string | null; brewery?: string | null; abv?: number | null };

const CORP = /농업회사법인|영농조합법인|농업법인|영농조합|협동조합|주식회사|유한회사|합자회사|\(주\)|㈜|\(농\)|\(유\)|\(영\)|\(합\)/g;
const norm = (s: string) => (s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^0-9a-z가-힣]/g, "");
const brewBase = (s: string) => norm((s || "").replace(CORP, " "));
const brewKey = (s: string) => {
  const base = brewBase(s);
  const k = base.replace(/양조장|양조원|양조|주조장|주조|술도가|도가|브루어리|증류소|와이너리|농원|명인|지점|본점|예천지점/g, "");
  return k.length >= 2 ? k : base;
};
export function sameBrewery(a: string, b: string): boolean {
  const x = brewKey(a), y = brewKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (s.length >= 3 && l.includes(s)) return true;   // 두 글자 핵심어("양주"도가)는 포함으로 치지 않는다 — 양주골이가 ≠ 양주도가
  // 띄어 쓴 한 낱말이 상대 이름 전체와 같으면 같은 양조장 — "풍정사계 화양" = "유한회사 화양"
  const words = (s0: string) => s0.replace(CORP, " ").split(/[\s()·,]+/).map(brewBase).filter((w) => w.length >= 2);
  const whole = (s0: string) => [brewKey(s0), brewBase(s0)];
  return words(a).some((w) => whole(b).includes(w)) || words(b).some((w) => whole(a).includes(w));
}
/** 이 이름이 양조장 이름 자체인가 (카탈로그 별칭에 들어 있는 양조장·옛 양조장 이름 거르기) */
const isBreweryName = (x: string, b: string) => !!b && (brewKey(x) === brewKey(b) || brewBase(x) === brewBase(b));
const aliasList = (a: AwardDrink["alias"]) => (Array.isArray(a) ? a : a ? [a] : []).filter(Boolean) as string[];

/**
 * 수상작 한 줄에 맞는 카탈로그 술 id (없거나 둘 이상이면 null)
 * - 양조장이 같아야 한다(카탈로그 별칭에 남은 옛 양조장 이름도 인정). 양조장을 모르면 이름이 완전히 같을 때만.
 * - 이름: 정규화해서 같거나, 한쪽이 다른 쪽을 품고 남는 부분이 양조장 이름·"도"·그 술 도수뿐일 때("중원당 청명주" = "청명주", "가무치소주 25" = "가무치소주 25도").
 *   "청명주 탁주"·"가무치소주 43도"처럼 종류·도수가 다른 변형은 붙이지 않는다.
 */
export function matchAwardDrink(entry: { name: string; brewery?: string | null }, drinks: AwardDrink[]): string | null {
  const a = norm(entry.name);
  if (a.length < 2) return null;
  const exact: string[] = [], near: string[] = [];
  for (const d of drinks) {
    const aliases = aliasList(d.alias);
    const brews = [d.brewery || "", ...aliases].filter(Boolean);
    const known = !!entry.brewery && !!d.brewery;
    if (known && !brews.some((b) => sameBrewery(entry.brewery!, b))) continue;
    // 별칭 중 양조장 이름(옛 이름 포함)은 제품 이름이 아니다
    const keys = [...new Set([d.name, ...aliases.filter((x) => !isBreweryName(x, d.brewery || "") && !isBreweryName(x, entry.brewery || ""))].map(norm).filter((k) => k.length >= 2))];
    if (keys.includes(a)) { exact.push(d.id); continue; }
    if (!known) continue;
    const brewTokens = [entry.brewery!, d.brewery!].flatMap((b) => [brewBase(b), brewKey(b)]).filter((t) => t.length >= 2).sort((x, y) => y.length - x.length);
    const abv = d.abv != null ? String(Math.round(d.abv)) : null;
    const ok = keys.some((k) => {
      const [s, l] = k.length <= a.length ? [k, a] : [a, k];
      if (s.length < 2 || !l.includes(s)) return false;
      let rem = l.replace(s, "");
      for (const t of brewTokens) rem = rem.replace(t, "");
      return rem === "" || rem === "도" || (!!abv && (rem === abv || rem === `${abv}도`));
    });
    if (ok) near.push(d.id);
  }
  const pick = exact.length ? exact : near;
  const uniq = [...new Set(pick)];
  return uniq.length === 1 ? uniq[0] : null;
}
