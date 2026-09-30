/**
 * 이름 매칭 — 본체는 core.ts(searchIn). 여기서는 모듈이 들고 있는 검색 문서(DOCS)를 넣어 부른다.
 * 브라우저 자동완성은 core.ts만 쓴다(카탈로그 데이터를 번들에 넣지 않으려고, 2026-09-30).
 */
import { DOCS, type Doc } from "./docs";
import { searchIn, suggestIn, type SearchOptions, type SearchResult } from "./core";

export { editDistance, searchIn, suggestIn, suggestHref, suggestItems, type Hit, type MatchKind, type SearchOptions, type SearchResult, type SuggestItem } from "./core";

/** 검색어 하나로 술·음식·둘러보기 항목을 찾는다 */
export const search = (q: string, opts: SearchOptions = {}): SearchResult => searchIn(DOCS, q, opts);
/** 결과가 없을 때: 자모 편집거리가 가까운 이름 n개 (술·음식만) */
export const suggest = (norm: string, n = 3): Doc[] => suggestIn(DOCS, norm, n);
