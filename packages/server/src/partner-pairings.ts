/**
 * 파트너(양조장) 페어링 입력(docs/25 §2) — partner_pairings(0038)가 원본, pairings·pairing_evidence에 동기화한다.
 *  - 저장: 기존 pairings 행이 없으면 official 90으로 새로 만들고(created), 있으면 스냅샷(prev)을 남기고 applyPartnerPairing 값으로 올린다. 근거 줄은 한 개(evidence_id).
 *  - 삭제: 근거 줄 삭제 → 우리가 만든 행이면 행 삭제, 아니면 prev로 되돌림.
 *  - 저장·삭제 뒤 catalog_meta.version을 올려 웹 카탈로그 캐시(15초)와 상세 화면(ISR 10분)이 새 값을 보게 한다.
 */
import { PARTNER_PAIRING_MAX_PER_DRINK, applyPartnerPairing, cleanPairingNote, partnerEvidence, partnerPairingProblem, profileFit, type DrinkProfile, type FoodProfile, type PairingSnapshot } from "@pairinggo/shared";
import { db } from "./db";
import type { Merchant } from "./reservations";

const need = () => { const c = db(); if (!c) throw new Error("DB 미설정"); return c; };
type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");

export type PartnerPairing = { id: number; drinkId: string; drinkName: string; foodId: string; foodName: string; note: string; createdAt: string };

const toItem = (r: Row): PartnerPairing => ({
  id: Number(r.id), drinkId: str(r.drink_id), drinkName: str((r.drinks as Row | null)?.name || r.drink_id), foodId: str(r.food_id), foodName: str((r.foods as Row | null)?.name || r.food_id),
  note: str(r.note), createdAt: str(r.created_at),
});
const SELECT = "*,drinks!partner_pairings_drink_id_fkey(name),foods!partner_pairings_food_id_fkey(name)";

export async function listPartnerPairings(merchantId: string): Promise<PartnerPairing[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("partner_pairings").select(SELECT).eq("merchant_id", merchantId).order("created_at").limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toItem);
}

async function bumpVersion() {
  const v = new Date().toISOString();
  await need().from("catalog_meta").upsert({ key: "version", value: v, updated_at: v });
}

function assertBrewery(m: Merchant) {
  if (m.kind !== "brewery") throw new Error("양조장 파트너만 페어링을 적을 수 있어요.");
  if (!m.brewery) throw new Error("매장 정보에서 '우리 양조장'을 먼저 골라 주세요.");
}

export async function savePartnerPairing(m: Merchant, raw: { drinkId?: unknown; foodId?: unknown; note?: unknown }): Promise<PartnerPairing> {
  assertBrewery(m);
  const c = need();
  const drinkId = str(raw.drinkId).trim(), foodId = str(raw.foodId).trim();
  const note = cleanPairingNote(raw.note);
  const { data: existingPp } = await c.from("partner_pairings").select("*").eq("merchant_id", m.id).eq("drink_id", drinkId).eq("food_id", foodId).maybeSingle();
  const { count } = await c.from("partner_pairings").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).eq("drink_id", drinkId);
  const problem = partnerPairingProblem({ drinkId, foodId, note, countForDrink: count ?? 0, editing: !!existingPp });
  if (problem) throw new Error(problem);

  const [{ data: drink }, { data: food }] = await Promise.all([
    c.from("drinks").select("id,name,brewery_name,abv,profile").eq("id", drinkId).maybeSingle(),
    c.from("foods").select("id,name,profile").eq("id", foodId).maybeSingle(),
  ]);
  if (!drink || str(drink.brewery_name) !== m.brewery) throw new Error("우리 양조장 술만 적을 수 있어요.");
  if (!food) throw new Error("카탈로그에 있는 음식 이름을 골라 주세요.");

  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const { data: pairing } = await c.from("pairings").select("id,source_tier,expert_score,reason").eq("drink_id", drinkId).eq("food_id", foodId).maybeSingle();
  let pairingId: number, created = false, prev: PairingSnapshot | null = null;
  if (pairing) {
    // 이미 우리가 올린 행이면 그 전 값(prev)을 기준으로 다시 계산한다(한 줄 이유를 고칠 때)
    prev = (existingPp?.prev as PairingSnapshot | null) ?? { tier: str(pairing.source_tier), es: Number(pairing.expert_score), reason: str(pairing.reason) };
    const next = applyPartnerPairing(prev, note, m.brewery);
    const u = await c.from("pairings").update({ source_tier: next.tier, expert_score: next.es, reason: next.reason, checked_on: today, updated_at: new Date().toISOString() }).eq("id", pairing.id);
    if (u.error) throw new Error(u.error.message);
    pairingId = Number(pairing.id);
    created = !!existingPp?.created;
  } else {
    const next = applyPartnerPairing(null, note, m.brewery);
    const dp = drink.profile as DrinkProfile | null, fp = food.profile as FoodProfile | null;
    const pf = dp && fp ? profileFit(dp, drink.abv == null ? null : Number(drink.abv), fp) : { s: 40, plus: [], minus: [] };
    const ins = await c.from("pairings").insert({ drink_id: drinkId, food_id: foodId, expert_score: next.es, reason: next.reason, blog_count: 0, source_tier: "official", status: "curated", profile_score: pf, checked_on: today }).select("id").single();
    if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "페어링 생성 실패");
    pairingId = Number(ins.data.id);
    created = true;
  }
  // 근거 줄은 파트너당 하나 — 있던 것은 지우고 새로
  if (existingPp?.evidence_id) await c.from("pairing_evidence").delete().eq("id", existingPp.evidence_id);
  const ev = await c.from("pairing_evidence").insert({ pairing_id: pairingId, ...partnerEvidence(m.brewery, note) }).select("id").single();
  if (ev.error || !ev.data) throw new Error(ev.error?.message ?? "근거 저장 실패");
  const up = await c.from("partner_pairings").upsert({ merchant_id: m.id, drink_id: drinkId, food_id: foodId, note, pairing_id: pairingId, evidence_id: Number(ev.data.id), created, prev, updated_at: new Date().toISOString() }, { onConflict: "merchant_id,drink_id,food_id" }).select(SELECT).single();
  if (up.error || !up.data) throw new Error(up.error?.message ?? "저장 실패");
  await bumpVersion();
  return toItem(up.data as unknown as Row);
}

export async function removePartnerPairing(m: Merchant, id: number): Promise<void> {
  const c = need();
  const { data: pp } = await c.from("partner_pairings").select("*").eq("id", id).eq("merchant_id", m.id).maybeSingle();
  if (!pp) throw new Error("없는 페어링이에요.");
  if (pp.evidence_id) await c.from("pairing_evidence").delete().eq("id", pp.evidence_id);
  if (pp.pairing_id) {
    if (pp.created) await c.from("pairings").delete().eq("id", pp.pairing_id);
    else if (pp.prev) { const p = pp.prev as PairingSnapshot; await c.from("pairings").update({ source_tier: p.tier, expert_score: p.es, reason: p.reason, updated_at: new Date().toISOString() }).eq("id", pp.pairing_id); }
  }
  const d = await c.from("partner_pairings").delete().eq("id", id);
  if (d.error) throw new Error(d.error.message);
  await bumpVersion();
}

export const partnerPairingLimit = PARTNER_PAIRING_MAX_PER_DRINK;
