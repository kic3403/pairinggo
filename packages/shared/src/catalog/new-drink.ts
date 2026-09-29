/**
 * 어드민에서 새 술 등록(2026-09-29 사용자 요청) — '없는 술' 요청을 처리할 때 카탈로그에서 고르는 게 아니라 그 자리에서 새 술을 만든다.
 * 판매처는 운영자가 직접 넣는다(찾아보기 링크로 도움). 맛 프로필은 같은 종류 술의 평균으로 채워 두고 고칠 수 있다.
 * 등록 때 맛 분석 추정 페어링 8개를 붙인다(add-drinks와 같은 planPairings) — 근거는 나중에 근거 검수로.
 */
import type { DrinkProfile } from "../types";

export const NEW_DRINK_CATEGORIES = ["탁주", "약주", "청주", "증류주", "과실주", "리큐르", "허니와인", "브랜디"] as const;
export const PROFILE_KEYS = ["sweet", "acid", "body", "fizz", "aroma"] as const;
export const PROFILE_LABEL: Record<(typeof PROFILE_KEYS)[number], string> = { sweet: "단맛", acid: "산미", body: "바디", fizz: "탄산", aroma: "향" };

/** 같은 종류 술들의 맛 프로필 평균(1~5 반올림) — 없으면 가운데 3 */
export function categoryAverageProfile(drinks: { category: string; profile?: DrinkProfile | null }[], category: string): DrinkProfile {
  const same = drinks.filter((d) => d.category === category && d.profile);
  const avg = (k: (typeof PROFILE_KEYS)[number]) => (same.length ? Math.min(5, Math.max(1, Math.round(same.reduce((s, d) => s + Number(d.profile![k] ?? 3), 0) / same.length))) : 3);
  return { sweet: avg("sweet"), acid: avg("acid"), body: avg("body"), fizz: avg("fizz"), aroma: avg("aroma") };
}

export const isSmartstoreUrl = (u: string) => /(^|\.)smartstore\.naver\.com|shopping\.naver\.com|brand\.naver\.com/.test((() => { try { return new URL(u).hostname; } catch { return ""; } })());

export type NewDrink = {
  name: string; category: string; abv: number | null; brewery: string; region: string; desc: string;
  buyUrl: string | null; buyStore: string | null; profile: DrinkProfile;
  /** '모름'으로 둔 맛 축 — profile에는 fallback(같은 종류 평균) 값이 들어간다 */
  profileUnknown: (typeof PROFILE_KEYS)[number][];
};
/** 맛 축 입력값이 '모름'인가 — 빈칸·null·"?"·"모름" */
export const isUnknownLevel = (v: unknown) => v == null || v === "" || v === "?" || v === "모름";

const hasLink = (s: string) => /https?:|www\./i.test(s);
const line = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** 입력 검사·정리 — 통과면 value, 아니면 한국어 안내. fallback = '모름' 축에 넣을 값(같은 종류 평균) */
export function cleanNewDrink(raw: Record<string, unknown>, fallback?: DrinkProfile): { ok: true; value: NewDrink } | { ok: false; problem: string } {
  const no = (problem: string) => ({ ok: false as const, problem });
  const name = line(raw.name, 40);
  if (name.length < 2) return no("술 이름을 2자 이상 적어 주세요");
  if (hasLink(name)) return no("술 이름에 링크를 넣을 수 없어요");
  const category = line(raw.category, 20);
  if (!(NEW_DRINK_CATEGORIES as readonly string[]).includes(category)) return no("종류를 골라 주세요");
  const abvRaw = String(raw.abv ?? "").trim();
  const abv = abvRaw === "" ? null : Number(abvRaw.replace(/[^0-9.]/g, ""));
  if (abv != null && !(Number.isFinite(abv) && abv > 0 && abv < 80)) return no("도수는 0보다 크고 80보다 작은 숫자로 적어 주세요(모르면 비워 두세요)");
  const brewery = line(raw.brewery, 40), region = line(raw.region, 30), desc = String(raw.desc ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (hasLink(brewery) || hasLink(region) || hasLink(desc)) return no("양조장·지역·설명에는 링크를 넣을 수 없어요");
  const url = line(raw.buyUrl, 500);
  let buyUrl: string | null = null;
  if (url) {
    let u: URL;
    try { u = new URL(url); } catch { return no("판매처 주소가 올바르지 않아요"); }
    if (u.protocol !== "https:") return no("판매처 주소는 https://로 시작해야 해요");
    if (/modoo\.at$/.test(u.hostname)) return no("modoo.at 주소는 쓰지 않아요 — 다른 판매처를 넣어 주세요");
    buyUrl = u.toString();
  }
  const buyStore = buyUrl ? line(raw.buyStore, 30) || (isSmartstoreUrl(buyUrl) ? "스마트스토어" : "판매처") : null;
  const p = (raw.profile ?? {}) as Record<string, unknown>;
  const profileUnknown = PROFILE_KEYS.filter((k) => isUnknownLevel(p[k]));
  const profile = Object.fromEntries(PROFILE_KEYS.map((k) => [k, Math.min(5, Math.max(1, Math.round(isUnknownLevel(p[k]) ? Number(fallback?.[k]) || 3 : Number(p[k]) || 3)))])) as DrinkProfile;
  return { ok: true, value: { name, category, abv, brewery, region, desc, buyUrl, buyStore, profile, profileUnknown } };
}

/** 판매처 페이지에 그 술 이름이 보이는가(띄어쓰기·기호 무시) — 스마트스토어가 아닌 주소는 이게 참이어야 넣는다(2026-09-24 사용자 규칙) */
export function pageShowsDrink(pageText: string, names: string[]): boolean {
  const sq = (s: string) => String(s ?? "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^가-힣a-z0-9]/g, "");
  const t = sq(pageText);
  return names.map(sq).filter((n) => n.length >= 2).some((n) => t.includes(n));
}

/** 찾아보기 링크 — 운영자가 판매처를 찾을 때 */
export function buySearchLinks(name: string) {
  const q = encodeURIComponent(name);
  return [
    { label: "네이버 쇼핑", url: `https://search.shopping.naver.com/search/all?query=${q}` },
    { label: "요즘이술", url: `https://www.yosool.co.kr/search/keyword.do?searchText=${q}` },
    { label: "더술닷컴", url: `https://thesool.com/front/find/M000000082/list.do?searchKeyword=${q}` },
    { label: "키햐", url: `https://m.kihya.com/goods/goods_search.php?keyword=${q}` },
    { label: "네이버 검색", url: `https://search.naver.com/search.naver?query=${q}+%EA%B3%B5%EC%8B%9D%EB%AA%B0` },
  ];
}
