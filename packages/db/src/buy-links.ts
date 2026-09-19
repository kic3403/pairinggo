/**
 * 추가 후보의 판매처 링크 모으기 — 업체가 직접 등록한 링크만 쓴다(스마트스토어 페이지는 읽지 않는다 — 네이버 약관).
 *   pnpm --filter @pairinggo/db buy-links   (expand-candidates 뒤) → research/buy-links.json → expand-candidates를 다시 돌리면 엑셀 '판매처' 칸에 채워진다
 *
 * 출처 순서: ① 요즘이술 제품 상세 "구매하러 가기"(업체 등록) ② 같은 곳 "홈페이지 바로가기" ③ 더술닷컴 제품 정보 홈페이지(양조장 등록)
 *           ④ 같은 양조장 다른 제품의 ①~③(양조장 단위 공식몰). SNS·블로그·카페 주소는 판매처로 쓰지 않는다.
 * 스마트스토어가 아닌 주소는 첫 화면이 열리는지만 확인한다(죽은 도메인 거르기). 못 찾은 술은 지금처럼 네이버쇼핑 검색으로 연결된다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadResearch, norm } from "./research";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANDS = join(ROOT, "research", "expand-candidates.json");
const OUT = join(ROOT, "research", "buy-links.json");
const CACHE = join(ROOT, "research", "awards", "yosool-links.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BuyLinkKind = "스마트스토어" | "공식몰·홈페이지";
export type BuyLink = { url: string; kind: BuyLinkKind; from: string; ok: boolean | null };
type Pick = { key: string; name: string; brewery: string; productId: string | null; sources: string[] };

/** 판매처로 쓸 수 있는 주소로 정리 — SNS·블로그·카페는 버림, 스마트스토어는 스토어 첫 화면까지만 */
export function cleanShopUrl(raw: string): { url: string; kind: BuyLinkKind } | null {
  let s = (raw || "").trim().split(/\s+/)[0];
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (/(instagram|facebook|youtube|twitter|x)\.com$|blog\.naver\.com$|cafe\.naver\.com$|tistory\.com$|band\.us$|kakao\.com$|thesool\.com$|yosool\.co\.kr$/.test(host)) return null;
  if (/modoo\.at$/.test(host)) return null;   // 네이버 모두 홈페이지 — 판매처로 쓰지 않는다(2026-09-20 사용자 결정)
  if (/^(smartstore|brand)\.naver\.com$/.test(host)) {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id ? { url: `https://${host}/${id}`, kind: "스마트스토어" } : null;
  }
  if (/(^|\.)shopping\.naver\.com$/.test(host)) return null;   // 검색·가격비교 주소 — 판매처가 아니다
  if (/(^|\.)google\.com$|forms\.gle$/.test(host)) return null;  // 주문 설문지 등
  if (!/\.[a-z]{2,}$/i.test(host) || /^[\d.]+$/.test(host)) return null;   // 도메인 끝이 없거나 IP
  return { url: `${u.protocol}//${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.replace(/\/$/, ""), kind: "공식몰·홈페이지" };
}

async function yosoolLinks(seq: number): Promise<{ buy: string | null; home: string | null }> {
  const r = await fetch("https://www.yosool.co.kr/search/alcohol.do", { method: "POST", headers: { "User-Agent": "Mozilla/5.0 (pairinggo research)", "Content-Type": "application/x-www-form-urlencoded" }, body: `seq=${seq}` });
  const html = r.ok ? await r.text() : "";
  const pick = (label: string) => html.match(new RegExp(`openBrowser\\('([^']+)'\\)[^>]*>\\s*<i class="[^"]*"></i>\\s*${label}`))?.[1] ?? null;
  return { buy: pick("구매하러 가기"), home: pick("홈페이지 바로가기") };
}

async function alive(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (pairinggo link check)" } });
    clearTimeout(t);
    return r.status < 400 || r.status === 403 || r.status === 405;   // 봇 차단(403)은 살아 있는 것으로 본다
  } catch { return false; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(CANDS)) { console.error("research/expand-candidates.json이 없습니다 — 먼저 expand-candidates"); process.exit(2); }
  const picks = (JSON.parse(readFileSync(CANDS, "utf8")) as { picks: Pick[] }).picks;
  const research = new Map(loadResearch().map((p) => [p.id, p]));
  const cache: Record<string, { buy: string | null; home: string | null }> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

  const found = new Map<string, BuyLink>();
  const byBrewery = new Map<string, BuyLink>();
  let fetched = 0;
  for (const p of picks) {
    const opts: { url: string; kind: BuyLinkKind; from: string }[] = [];
    for (const src of p.sources) {
      const seq = src.match(/yosool\.co\.kr\/search\/alcohol\.do\?seq=(\d+)/)?.[1];
      if (!seq) continue;
      if (!cache[seq]) { await sleep(400); cache[seq] = await yosoolLinks(Number(seq)); fetched++; }
      const b = cleanShopUrl(cache[seq].buy ?? ""), h = cleanShopUrl(cache[seq].home ?? "");
      if (b) opts.push({ ...b, from: "요즘이술 구매하러 가기(업체 등록)" });
      if (h) opts.push({ ...h, from: "요즘이술 홈페이지(업체 등록)" });
    }
    const hp = p.productId ? cleanShopUrl(research.get(p.productId)?.homepage ?? "") : null;
    if (hp) opts.push({ ...hp, from: "더술닷컴 홈페이지(양조장 등록)" });
    // 스마트스토어 먼저, 그다음 출처 순서
    const best = opts.sort((a, b) => Number(b.kind === "스마트스토어") - Number(a.kind === "스마트스토어"))[0];
    if (best) {
      const link: BuyLink = { ...best, ok: null };
      found.set(p.key, link);
      const bk = norm(p.brewery);
      const prev = byBrewery.get(bk);
      if (!prev || (prev.kind !== "스마트스토어" && link.kind === "스마트스토어")) byBrewery.set(bk, link);
    }
  }
  writeFileSync(CACHE, JSON.stringify(cache, null, 1) + "\n");
  for (const p of picks) {
    if (found.has(p.key)) continue;
    const b = byBrewery.get(norm(p.brewery));
    if (b) found.set(p.key, { ...b, from: `같은 양조장 제품의 ${b.from}` });
  }
  // 스마트스토어가 아닌 주소는 첫 화면이 열리는지만 — 옛 사이트는 https가 안 되고 http만 되는 곳이 많아 둘 다 본다(https 먼저)
  const checked = new Map<string, string | null>();
  for (const l of found.values()) {
    if (l.kind === "스마트스토어") continue;
    if (!checked.has(l.url)) {
      const https = l.url.replace(/^http:/, "https:"), http = l.url.replace(/^https:/, "http:");
      checked.set(l.url, (await alive(https)) ? https : (await alive(http)) ? http : null);
    }
    const ok = checked.get(l.url)!;
    l.ok = !!ok;
    if (ok) l.url = ok;
  }
  const out = Object.fromEntries(found);
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  const vals = [...found.values()];
  console.log(`추천 ${picks.length}종 중 판매처 찾음 ${vals.length} — 스마트스토어 ${vals.filter((l) => l.kind === "스마트스토어").length} · 공식몰·홈페이지 ${vals.filter((l) => l.kind !== "스마트스토어").length}(안 열림 ${vals.filter((l) => l.ok === false).length}) · 같은 양조장 링크 ${vals.filter((l) => l.from.startsWith("같은")).length} · 못 찾음 ${picks.length - vals.length}\n요즘이술 상세 새로 읽음 ${fetched} → ${OUT}`);
}
