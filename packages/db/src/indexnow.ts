/**
 * IndexNow 제출(2026-09-28) — 배포된 사이트맵의 주소를 한 번에 네이버·빙 등에 알린다(api.indexnow.org가 참여 검색엔진에 나눠 준다).
 * 키는 배포된 /indexnow-key.txt에서 읽는다(웹 app/indexnow-key.txt/route.ts가 원본). 카탈로그를 크게 바꾼 뒤·새 화면을 연 뒤에 돌린다.
 *   pnpm --filter @pairinggo/db indexnow [--site https://pairinggo.kr] [--dry]
 */
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const SITE = (arg("--site") ?? process.env.SITE_URL ?? "https://pairinggo.kr").replace(/\/+$/, "");
const DRY = process.argv.includes("--dry");

const keyRes = await fetch(`${SITE}/indexnow-key.txt`);
const key = (await keyRes.text()).trim();
if (!keyRes.ok || !/^[a-f0-9]{8,128}$/i.test(key)) { console.error(`키 파일을 읽지 못했습니다(${keyRes.status}) — 웹을 먼저 배포하세요: ${SITE}/indexnow-key.txt`); process.exit(2); }
const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&")).filter((u) => u.startsWith(SITE));
console.log(`사이트맵 주소 ${urls.length}개 · 키 ${key.slice(0, 6)}…`);
if (DRY) process.exit(0);
const host = new URL(SITE).host;
// 공용 창구(api.indexnow.org)가 막히는 망이 있어(2026-09-30 이 PC에서 연결 끊김) 네이버·빙 창구로도 직접 보낸다 — 한 곳만 받아도 참여 엔진끼리 나눈다
const ENDPOINTS = ["https://searchadvisor.naver.com/indexnow", "https://www.bing.com/indexnow", "https://api.indexnow.org/indexnow"];
let ok = 0;
for (const ep of ENDPOINTS) {
  for (let i = 0; i < urls.length; i += 10000) {
    try {
      const r = await fetch(ep, {
        method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key, keyLocation: `${SITE}/indexnow-key.txt`, urlList: urls.slice(i, i + 10000) }),
        signal: AbortSignal.timeout(30000),
      });
      const good = r.status === 200 || r.status === 202;
      if (good) ok++;
      console.log(`${new URL(ep).host} 제출 ${Math.min(urls.length, i + 10000)}/${urls.length} → HTTP ${r.status}${good ? " (접수)" : ` ${(await r.text().catch(() => "")).slice(0, 200)}`}`);
    } catch (e) { console.log(`${new URL(ep).host} 연결 실패 — ${(e as Error).message}`); }
  }
}
if (!ok) process.exit(1);

export {};
