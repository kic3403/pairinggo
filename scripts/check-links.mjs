#!/usr/bin/env node
/**
 * 페어링GO 링크 상태 점검
 *   - 술 구매 링크(buy.url), 추천 근거 URL(pairings[].ev.url), 양조장 직판 정보(offline.place/phone)를 점검
 *   - 결과: packages/shared/data/link-status.json (앱이 읽어 죽은 링크를 네이버쇼핑 폴백으로 대체)
 *           reports/link-check-YYYY-MM-DD.md (사람이 읽는 요약)
 *   실행: node scripts/check-links.mjs [--concurrency 6] [--timeout 15000] [--only buy|ev]
 *   주의: 이 스크립트는 외부 네트워크가 열린 환경(로컬 PC, GitHub Actions)에서 실행해야 합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true] : []).filter(Boolean));
const CONCURRENCY = parseInt(args.concurrency || "6");
const TIMEOUT = parseInt(args.timeout || "15000");
const ONLY = args.only || "all";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 모노레포 이전(2026-09) 뒤 데이터는 packages/shared/data — 옛 경로(src/data)를 읽어 주간 점검이 9월 2일 이후 멈춰 있었다(docs/20 P0-3)
const DATA_PATH = path.join(ROOT, "packages/shared/data/pairings.json");
const STATUS_PATH = path.join(ROOT, "packages/shared/data/link-status.json");
const REPORT_DIR = path.join(ROOT, "reports");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const prev = fs.existsSync(STATUS_PATH) ? JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) : { checkedAt: null, links: {} };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PairingGO-LinkCheck/1.0";
// 품절 판정은 '페이지 어딘가에 품절이라는 낱말'이 아니라, 상품 상태 표시에 쓰이는 강한 패턴만 본다 (쇼핑몰 템플릿의 "품절 상품 제외" 같은 문구로 오탐하지 않게)
const SOLDOUT_RE = /(class="[^"]*\b(sold[-_]?out|soldout)\b[^"]*"|icon_status_soldout|"isSoldOut"\s*:\s*true|"soldOut"\s*:\s*true|>\s*(일시\s*)?품절\s*<|>\s*SOLD\s*OUT\s*<|판매\s*종료된\s*상품|현재\s*판매하지\s*않는\s*상품|상품이\s*존재하지\s*않|삭제된\s*상품)/i;
const NOTFOUND_RE = /(페이지를 찾을 수 없|존재하지 않는 페이지|page not found|404 not found|삭제되었거나|접근할 수 없는 페이지)/i;

/** 점검 대상 수집 */
const targets = [];
for (const d of data.drinks) {
  if (d.buy?.url && ONLY !== "ev") targets.push({ url: d.buy.url, kind: "buy", ref: d.id, label: `${d.name} · ${d.buy.store || ""}` });
}
const seen = new Set();
for (const p of data.pairings) {
  const u = p.ev?.url;
  if (!u || seen.has(u) || ONLY === "buy") continue;
  seen.add(u);
  targets.push({ url: u, kind: "ev", ref: `${p.d}|${p.f}`, label: p.ev.source || "" });
}

async function check(t) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const out = { url: t.url, kind: t.kind, ref: t.ref, label: t.label, status: "ok", http: null, finalUrl: null, note: "", ms: 0 };
  try {
    let res = await fetch(t.url, { method: "GET", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, "Accept-Language": "ko,en;q=0.8" } });
    out.http = res.status; out.finalUrl = res.url !== t.url ? res.url : null;
    if (res.status === 404 || res.status === 410) out.status = "dead";
    else if (res.status >= 500) out.status = "error";
    else if (res.status === 403 || res.status === 429) out.status = "blocked";   // 봇 차단 — 죽은 링크로 취급하지 않음
    else if (res.status >= 400) out.status = "error";
    else {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        const html = (await res.text()).slice(0, 400_000);
        if (NOTFOUND_RE.test(html)) out.status = "dead", out.note = "본문에 '페이지 없음' 문구";
        else if (t.kind === "buy" && SOLDOUT_RE.test(html)) out.status = "soldout", out.note = "품절/판매종료 상태 표시 감지 (참고용 · 수동 확인)";
      }
    }
  } catch (e) {
    out.status = e.name === "AbortError" ? "timeout" : "error";
    out.note = (e.cause?.code || e.message || "").slice(0, 80);
  } finally { clearTimeout(timer); out.ms = Date.now() - started; }
  return out;
}

async function run() {
  console.log(`링크 ${targets.length}개 점검 시작 (동시 ${CONCURRENCY}, 타임아웃 ${TIMEOUT}ms)`);
  const results = []; let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < targets.length) { const t = targets[i++]; const r = await check(t); results.push(r); process.stdout.write(`${r.status.padEnd(8)} ${String(r.http ?? "-").padEnd(4)} ${r.label.slice(0, 40)}\n`); }
  }));
  const now = new Date().toISOString();
  const links = { ...prev.links };
  for (const r of results) {
    const p = links[r.url] || { firstBad: null, badStreak: 0 };
    const bad = r.status === "dead";   // 폴백은 '죽은 링크'만. 품절은 참고용(재입고 가능)
    links[r.url] = {
      kind: r.kind, ref: r.ref, status: r.status, http: r.http, note: r.note, finalUrl: r.finalUrl, checkedAt: now,
      // 죽은 링크는 2회 연속 확인될 때만 앱에서 폴백 처리 (일시 장애 오탐 방지)
      badStreak: bad ? (p.badStreak || 0) + 1 : 0, firstBad: bad ? (p.firstBad || now) : null,
      confirmedBad: bad && (p.badStreak || 0) + 1 >= 2,
    };
  }
  fs.writeFileSync(STATUS_PATH, JSON.stringify({ checkedAt: now, total: targets.length, links }, null, 1));

  const by = (s) => results.filter((r) => r.status === s);
  const lines = [
    `# 페어링GO 링크 점검 · ${now.slice(0, 10)}`, "",
    `총 ${targets.length}개 (구매 ${targets.filter((t) => t.kind === "buy").length} · 근거 ${targets.filter((t) => t.kind === "ev").length})`, "",
    `| 상태 | 건수 | 의미 |`, `|---|---|---|`,
    `| ok | ${by("ok").length} | 정상 |`,
    `| soldout | ${by("soldout").length} | 품절·판매종료 상태 표시 감지 (참고용, 폴백 없음) |`,
    `| dead | ${by("dead").length} | 404/410 또는 '페이지 없음' — 2회 연속이면 앱에서 네이버쇼핑 폴백 |`,
    `| blocked | ${by("blocked").length} | 봇 차단(403/429) — 링크 자체는 살아 있을 가능성 큼, 수동 확인 |`,
    `| error | ${by("error").length} | 5xx·DNS·기타 오류 |`,
    `| timeout | ${by("timeout").length} | ${TIMEOUT / 1000}초 내 응답 없음 |`, "",
  ];
  for (const s of ["soldout", "dead", "error", "timeout", "blocked"]) {
    const rs = by(s); if (!rs.length) continue;
    lines.push(`## ${s} (${rs.length})`, "");
    for (const r of rs) lines.push(`- [${r.kind}] ${r.label} — ${r.url}${r.http ? ` (HTTP ${r.http})` : ""}${r.note ? ` · ${r.note}` : ""}`);
    lines.push("");
  }
  const confirmed = Object.entries(links).filter(([, v]) => v.confirmedBad);
  lines.push(`## 앱 폴백 적용 중 (2회 연속 불량): ${confirmed.length}`, "", ...confirmed.map(([u, v]) => `- [${v.kind}] ${v.ref} — ${u}`), "");
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const rp = path.join(REPORT_DIR, `link-check-${now.slice(0, 10)}.md`);
  fs.writeFileSync(rp, lines.join("\n"));
  fs.writeFileSync(path.join(REPORT_DIR, "latest.md"), lines.join("\n"));
  console.log(`\n완료 → ${path.relative(ROOT, STATUS_PATH)}, ${path.relative(ROOT, rp)}`);
  const problems = by("soldout").length + by("dead").length + by("error").length + by("timeout").length;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `problems=${problems}\nreport=${path.relative(ROOT, rp)}\n`);
}
run().catch((e) => { console.error(e); process.exit(1); });
