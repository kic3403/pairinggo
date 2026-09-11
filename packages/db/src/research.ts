/**
 * research/ 원본 로더 — 더술닷컴(aT) 제품 + 수동 추가분. template.ts(술 목록 확장)와 regional-list.ts가 공유.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sidoOf, sigunguOf, type Sido } from "./sido";

const R = (f: string) => join(dirname(fileURLToPath(import.meta.url)), "..", "research", f);

export type ResearchProduct = {
  id: string; name: string; brewery: string; address: string; sido: Sido; sigungu: string; kind: string; abv: number | null; volume: string;
  ingredients: string; intro: string; food: string; awards: string; tags: string; homepage: string; phone: string; source: string; url: string;
};
export const norm = (s: string) => (s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^0-9a-z가-힣]/g, "");
export const normBrew = (s: string) => norm(s.replace(/농업회사법인|영농조합법인|영농조합|협동조합|주식회사|유한회사|\(주\)|㈜|\(농\)|\(유\)|\(영\)|\(합\)|합자회사/g, ""));
/** 양조장 이름 비교용 핵심어 (양조장·주조·도가 등 접미사 제거) */
export const brewKey = (s: string) => { const base = normBrew(s); const k = base.replace(/양조장|양조원|양조|주조장|주조|술도가|도가|브루어리|증류소|와이너리|농원|명인|보존회|문화관|종가/g, ""); return k.length >= 2 ? k : base; }; // "한증류소"처럼 접미사를 빼면 한 글자가 되는 이름은 원형 유지
/** 양조장 개명 — 더술닷컴 등록명이 옛 이름일 때 현재 이름으로 (사용자 확인 2026-09-11) */
const BREWERY_RENAME: [RegExp, string][] = [[/두레박/, "한증류소"]];
export const renameBrew = (s: string) => { for (const [re, to] of BREWERY_RENAME) if (re.test(s)) return to; return s; };
const unent = (s: string) => (s || "").replace(/&amp;/g, "&").replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const abvNum = (s: string) => { const m = (s || "").match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) : null; };

let cache: ResearchProduct[] | null = null;
/** 더술닷컴 전수(1,300종) + manual-additions.json. research/가 없으면 빈 배열 */
export function loadResearch(): ResearchProduct[] {
  if (cache) return cache;
  const out: ResearchProduct[] = [];
  const f = R("thesool-products.json");
  if (existsSync(f)) {
    const raw = JSON.parse(readFileSync(f, "utf8")) as Record<string, { id: string; name: string; region?: string; detail?: Record<string, string> } | boolean>;
    for (const p of Object.values(raw)) {
      if (typeof p !== "object" || !p.detail?.brewery) continue;
      const d = p.detail;
      const address = unent(d.address);
      out.push({
        id: p.id, name: unent(d.name || p.name), brewery: renameBrew(unent(d.brewery)), address, sido: sidoOf(address), sigungu: sigunguOf(address), kind: d.kind || "-", abv: abvNum(d.abv), volume: d.volume || "",
        ingredients: unent(d.ingredients), intro: unent(d.intro), food: unent(d.food), awards: d.awards === "-" ? "" : unent(d.awards), tags: d.tags || "",
        homepage: /^(https?:\/\/|www\.|[a-z0-9-]+\.(com|kr|net|co\.kr|modoo\.at))/i.test((d.homepage || "").trim()) ? d.homepage.trim().split(/\s+/)[0] : "",
        phone: /^[\d\-().\s~,/]{7,40}$/.test((d.phone || "").trim()) ? d.phone.trim() : "",
        source: "더술닷컴(aT)", url: `https://thesool.com/front/find/M000000082/view.do?productId=${p.id}`,
      });
    }
  }
  const m = R("manual-additions.json");
  if (existsSync(m)) {
    type Manual = { name: string; brewery: string; sido: Sido; sigungu: string; address: string; kind: string; abv: number | null; volume: string; ingredients: string; intro: string; source: string; url: string };
    for (const [i, x] of (JSON.parse(readFileSync(m, "utf8")) as Manual[]).entries()) {
      out.push({ id: `MANUAL${i + 1}`, name: x.name, brewery: x.brewery, address: x.address, sido: x.sido, sigungu: x.sigungu, kind: x.kind, abv: x.abv, volume: x.volume, ingredients: x.ingredients, intro: x.intro, food: "", awards: "", tags: "", homepage: "", phone: "", source: `웹 조사 · ${x.source}`, url: x.url });
    }
  }
  cache = out;
  return out;
}

/** 양조장 이름으로 제품 찾기 (접미사 무시 핵심어 일치) */
export function productsOfBrewery(brewery: string): ResearchProduct[] {
  const k = brewKey(brewery);
  if (k.length < 2) return [];
  return loadResearch().filter((p) => { const pk = brewKey(p.brewery); return pk === k || (k.length >= 3 && pk.length >= 3 && (pk.includes(k) || k.includes(pk))); });
}
