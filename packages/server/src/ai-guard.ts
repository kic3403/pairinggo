/**
 * AI(Claude) 호출 보호(2026-09-28) — Anthropic API 크레딧이 떨어지면 API는 400 "credit balance is too low"를 돌려준다.
 * 예전엔 이것이 "사진을 읽지 못했어요. 다른 사진으로 시도해 주세요"로 보여 손님이 사진만 계속 바꿔 찍었고, 운영자는 몰랐다.
 *   · 크레딧·결제 오류를 알아보고(isCreditError) AiUnavailableError로 바꾼다 → 각 기능이 "지금 쓸 수 없어요 — 직접 입력/이름 검색" 안내
 *   · 운영 오류 기록(server_errors, 'ai:credit')과 catalog_meta.ai_status에 남긴다 → 어드민 첫 화면 경고
 *   · 멈춘 뒤 30분 동안은 호출하지 않고 바로 안내한다(인스턴스 메모리 + DB 1분 캐시). 30분이 지나면 한 번 시도해 보고, 되면 경고를 지운다
 * 메뉴판·라벨·영수증 읽기(두 앱 공용)가 같은 보호를 쓴다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { currentApp, reportError } from "./errors";

export const AI_PAUSE_MS = 30 * 60 * 1000;
const CHECK_MS = 60 * 1000;

export class AiUnavailableError extends Error {
  constructor() { super("AI 사진 읽기를 잠시 쓸 수 없어요"); this.name = "AiUnavailableError"; }
}

/** 크레딧·결제 문제로 막힌 호출인가(400 invalid_request "credit balance" · 402 · 결제 관련 문구) */
export function isCreditError(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false;
  const m = String(e.message ?? "");
  return e.status === 402 || /credit balance|billing|purchase credits|plans\s*&\s*billing/i.test(m);
}

export type AiStatus = { downAt: string | null; feature: string | null };
let mem: { at: number; status: AiStatus } | null = null;

export async function aiStatus(force = false): Promise<AiStatus> {
  if (!force && mem && Date.now() - mem.at < CHECK_MS) return mem.status;
  const c = db();
  let status: AiStatus = { downAt: null, feature: null };
  if (c) {
    const { data } = await c.from("catalog_meta").select("value").eq("key", "ai_status").maybeSingle();
    const v = (data?.value ?? null) as { down_at?: string | null; feature?: string | null } | null;
    if (v?.down_at) status = { downAt: v.down_at, feature: v.feature ?? null };
  }
  mem = { at: Date.now(), status };
  return status;
}

async function setStatus(downAt: string | null, feature: string | null) {
  mem = { at: Date.now(), status: { downAt, feature } };
  const c = db();
  if (!c) return;
  const now = new Date().toISOString();
  await c.from("catalog_meta").upsert({ key: "ai_status", value: { down_at: downAt, feature }, updated_at: now });
}

/** 지금 멈춤 중인가 — 멈춘 지 30분 안이면 true */
export const aiPaused = (s: AiStatus, now = Date.now()) => !!s.downAt && now - Date.parse(s.downAt) < AI_PAUSE_MS;

/** Claude 호출을 감싼다 — 멈춤 중이면 부르지 않고, 크레딧 오류면 기록·멈춤, 성공하면 경고를 지운다 */
export async function aiGuarded<T>(feature: string, fn: () => Promise<T>): Promise<T> {
  const s = await aiStatus().catch(() => ({ downAt: null, feature: null }));
  if (aiPaused(s)) throw new AiUnavailableError();
  try {
    const r = await fn();
    if (s.downAt) await setStatus(null, null).catch(() => {});
    return r;
  } catch (e) {
    if (isCreditError(e)) {
      await setStatus(new Date().toISOString(), feature).catch(() => {});
      await reportError(currentApp(), "ai:credit", "Anthropic API 크레딧 소진 — 콘솔에서 충전 필요", { feature });
      throw new AiUnavailableError();
    }
    throw e;
  }
}
