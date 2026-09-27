/**
 * 근거 링크·인용문 검증(2026-09-27, docs/26 §3-3) — 판정 규칙은 shared pairing/evidence-check.ts, 여기는 가져오기와 저장.
 *   · 가장 오래 확인하지 않은 근거부터(checked_at nulls first) 한 번에 limit개, 동시 conc개
 *   · 네이버 블로그는 모바일 주소로, 한국 사이트의 EUC-KR 페이지는 문자셋을 읽어 풀어 인용문을 찾는다(깨진 글자로 '없음' 판정이 나지 않게)
 *   · 결과는 pairing_evidence.link_status·checked_at·fail_count·quote_ok·check_note. 무게가 바뀐 줄이 있으면 catalog_meta.version을 올려
 *     웹 카탈로그가 15초 안에 새 신뢰도로 다시 읽는다(정적 번들은 db:export 때 반영)
 * 크론 /api/cron/evidence(매일 48개 → 약 2주에 한 바퀴)와 스크립트 packages/db evidence-check(--all)가 같이 쓴다.
 */
import { evidenceFactor, judgeFetch, nextFailCount, readableUrl, type LinkStatus } from "@pairinggo/shared";
import { db } from "./db";

const UA = "Mozilla/5.0 (compatible; PairingGO-evidence-check/1.0; +https://pairinggo.vercel.app)";
const MAX_BYTES = 2_000_000;

function charsetOf(contentType: string | null, head: string): string {
  const m = (contentType ?? "").match(/charset=([\w-]+)/i) ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i);
  const cs = (m?.[1] ?? "utf-8").toLowerCase();
  return cs === "ks_c_5601-1987" || cs === "euc_kr" ? "euc-kr" : cs;
}

/** 페이지 한 장 — 상태 코드와 글자(스크립트·스타일 뺌). 연결 실패면 status null */
export async function fetchPage(url: string, timeoutMs = 8000): Promise<{ status: number | null; text: string }> {
  try {
    const r = await fetch(readableUrl(url), { redirect: "follow", headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return { status: r.status, text: "" };
    const buf = new Uint8Array(await r.arrayBuffer()).slice(0, MAX_BYTES);
    const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
    let text: string;
    try { text = new TextDecoder(charsetOf(r.headers.get("content-type"), head)).decode(buf); } catch { text = new TextDecoder("utf-8").decode(buf); }
    text = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
    return { status: r.status, text };
  } catch { return { status: null, text: "" }; }
}

export type EvidenceCheckResult = { checked: number; byStatus: Record<LinkStatus, number>; factorChanged: number; samples: { url: string; status: LinkStatus; note: string }[] };

type Row = { id: number; url: string; quote: string | null; link_status: string | null; fail_count: number | null };

export async function checkEvidenceBatch(opts: { limit?: number; conc?: number; all?: boolean } = {}): Promise<EvidenceCheckResult> {
  const c = db();
  const res: EvidenceCheckResult = { checked: 0, byStatus: { ok: 0, quote_missing: 0, dead: 0, blocked: 0, unverifiable: 0 }, factorChanged: 0, samples: [] };
  if (!c) return res;
  const limit = opts.all ? 5000 : Math.max(1, Math.min(500, opts.limit ?? 48));
  const { data, error } = await c.from("pairing_evidence").select("id,url,quote,link_status,fail_count").not("url", "is", null).order("checked_at", { ascending: true, nullsFirst: true }).order("id").limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      const page = await fetchPage(r.url);
      const j = judgeFetch({ url: r.url, status: page.status, text: page.text, quote: r.quote });
      const fail = nextFailCount(r.fail_count ?? 0, j.status);
      const before = evidenceFactor(r), after = evidenceFactor({ link_status: j.status, fail_count: fail });
      if (before !== after) res.factorChanged++;
      await c.from("pairing_evidence").update({ link_status: j.status, fail_count: fail, quote_ok: j.quoteOk, check_note: j.note.slice(0, 200), checked_at: new Date().toISOString() }).eq("id", r.id);
      res.checked++; res.byStatus[j.status]++;
      if (j.status !== "ok" && res.samples.length < 20) res.samples.push({ url: r.url, status: j.status, note: j.note });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(12, opts.conc ?? 8)) }, worker));
  if (res.factorChanged) {
    const v = new Date().toISOString();
    await c.from("catalog_meta").upsert({ key: "version", value: v, updated_at: v });
  }
  return res;
}
