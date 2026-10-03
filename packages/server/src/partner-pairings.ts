/**
 * 파트너 페어링(docs/25 §2 · 2026-09-29 확장) — partner_pairings가 원본, 카탈로그에 연결되면 pairings·pairing_evidence에 동기화한다.
 *  - 양조장: 우리 양조장 술(카탈로그 id) × 음식 글자. 식당: 술 글자 × 음식 글자(둘 다 매장 표에서 고르거나 직접 입력).
 *  - 저장 때 글자를 카탈로그와 자동 연결(shared resolveFoodText·resolveDrinkText). 술·음식 둘 다 연결되면 pairings를 만들거나(created) 올리고(prev)
 *    official 근거 한 줄(양조장 "○○ 제공" · 식당 "○○ 추천")을 붙인다. 하나라도 연결 안 되면 글자만 저장 — 추천 칸·검색에 보인다.
 *  - 고치기 = 이전 연결 되돌리기 + 새로 저장. 되돌리기: 근거 삭제 → 우리가 만든 행은 다른 근거가 없을 때만 삭제,
 *    아니면 prev 복원(현재 official이고 다른 공식 근거가 없을 때만 — 그 사이 다른 양조장·전문가가 보탠 것을 덮지 않게).
 *  - 저장·삭제 뒤 catalog_meta.version을 올려 웹 카탈로그 캐시(15초)와 상세 화면(ISR 10분)이 새 값을 보게 한다.
 */
import {
  PARTNER_PAIRING_MAX_PER_DRINK, PARTNER_SUGGEST_PER_DRINK, applyPartnerPairing, cleanPairingNote, normFoodText, partnerEvidence, partnerPairingProblem, profileFit, resolveDrinkText, resolveFoodText, suggestPairings,
  type DrinkProfile, type FoodLite, type FoodProfile, type PairingSnapshot, type PairingSuggestion, type PartnerPairingKind, type SuggestInput,
} from "@pairinggo/shared";
import { db } from "./db";
import type { Merchant } from "./reservations";

const need = () => { const c = db(); if (!c) throw new Error("DB 미설정"); return c; };
type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");

export type PartnerPairing = {
  id: number; drinkId: string | null; drinkText: string; foodId: string | null; foodText: string; note: string; createdAt: string;
  /** 카탈로그에 연결된 이름(없으면 null) — 둘 다 있으면 손님 화면 카드에 official 근거로 실린다 */
  linkedDrink: string | null; linkedFood: string | null; linked: boolean;
};

/* ---------- 카탈로그(연결용, 10분) ---------- */
let cat: { at: number; foods: FoodLite[]; drinks: { id: string; name: string }[]; byId: Map<string, string> } | null = null;
async function catalog() {
  if (cat && Date.now() - cat.at < 600_000) return cat;
  const c = need();
  const [f, d] = await Promise.all([
    c.from("foods").select("id,name,alias,category").limit(3000),
    c.from("drinks").select("id,name,is_demo").limit(5000),
  ]);
  const foods = ((f.data ?? []) as Row[]).map((r) => ({ id: str(r.id), name: str(r.name), alias: (r.alias as string[] | null) ?? [], category: (r.category as string | null) ?? null }));
  const drinks = ((d.data ?? []) as Row[]).filter((r) => !r.is_demo).map((r) => ({ id: str(r.id), name: str(r.name) }));
  cat = { at: Date.now(), foods, drinks, byId: new Map([...foods.map((x) => [x.id, x.name] as const), ...drinks.map((x) => [x.id, x.name] as const)]) };
  return cat;
}

const toItem = (r: Row, names: Map<string, string>): PartnerPairing => {
  const drinkId = (r.drink_id as string | null) ?? null, foodId = (r.food_id as string | null) ?? null;
  return {
    id: Number(r.id), drinkId, drinkText: str(r.drink_text), foodId, foodText: str(r.food_text), note: str(r.note), createdAt: str(r.created_at),
    linkedDrink: drinkId ? names.get(drinkId) ?? null : null, linkedFood: foodId ? names.get(foodId) ?? null : null, linked: !!(drinkId && foodId && r.evidence_id),
  };
};

export async function listPartnerPairings(merchantId: string): Promise<PartnerPairing[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("partner_pairings").select("*").eq("merchant_id", merchantId).order("created_at").limit(500);
  if (error) throw new Error(error.message);
  const k = await catalog();
  return ((data ?? []) as Row[]).map((r) => toItem(r, k.byId));
}

async function bumpVersion() {
  const v = new Date().toISOString();
  await need().from("catalog_meta").upsert({ key: "version", value: v, updated_at: v });
}

function kindOf(m: Merchant): PartnerPairingKind {
  if (m.kind === "brewery") {
    if (!m.brewery) throw new Error("매장 정보에서 '우리 양조장'을 먼저 골라 주세요.");
    return "brewery";
  }
  if (m.kind === "restaurant") return "restaurant";
  throw new Error("양조장·식당 파트너만 페어링을 적을 수 있어요.");
}
/** 근거에 보일 이름 — 양조장은 카탈로그 양조장 이름("한증류소"), 식당은 매장 이름 */
const evidenceName = (m: Merchant, kind: PartnerPairingKind) => (kind === "brewery" ? m.brewery : m.name);

/** 이전 연결 되돌리기(행은 남긴다) */
async function unlink(c: ReturnType<typeof need>, pp: Row) {
  if (pp.evidence_id) await c.from("pairing_evidence").delete().eq("id", pp.evidence_id);
  if (!pp.pairing_id) return;
  const { data: p } = await c.from("pairings").select("id,source_tier").eq("id", pp.pairing_id).maybeSingle();
  if (!p) return;
  const { data: rest } = await c.from("pairing_evidence").select("tier").eq("pairing_id", pp.pairing_id);
  if (pp.created && !(rest ?? []).length) { await c.from("pairings").delete().eq("id", pp.pairing_id); return; }
  const prev = pp.prev as PairingSnapshot | null;
  const otherOfficial = (rest ?? []).some((e) => e.tier === "official" || e.tier === "sommelier");
  if (prev && str(p.source_tier) === "official" && !otherOfficial) {
    await c.from("pairings").update({ source_tier: prev.tier, expert_score: prev.es, reason: prev.reason, updated_at: new Date().toISOString() }).eq("id", pp.pairing_id);
  }
}

export async function savePartnerPairing(m: Merchant, raw: { drinkId?: unknown; drinkText?: unknown; foodText?: unknown; note?: unknown }): Promise<PartnerPairing> {
  const kind = kindOf(m);
  const c = need();
  const k = await catalog();
  const note = cleanPairingNote(raw.note);
  const foodText = str(raw.foodText).replace(/\s+/g, " ").trim().slice(0, 30);

  // 술 — 양조장은 우리 술(카탈로그 id), 식당은 적은 이름(카탈로그에 있으면 연결)
  let drinkId: string | null = null, drinkText = "", drinkKey = "", drinkRow: Row | null = null;
  if (kind === "brewery") {
    drinkId = str(raw.drinkId).trim();
    const { data } = await c.from("drinks").select("id,name,brewery_name,abv,profile").eq("id", drinkId).maybeSingle();
    if (!data || str(data.brewery_name) !== m.brewery) throw new Error("우리 양조장 술만 적을 수 있어요.");
    drinkRow = data as Row; drinkText = str(data.name); drinkKey = drinkId;
  } else {
    drinkText = str(raw.drinkText).replace(/\s+/g, " ").trim().slice(0, 40);
    drinkKey = normFoodText(drinkText);
    drinkId = resolveDrinkText(drinkText, k.drinks)?.id ?? null;
  }
  const foodKey = normFoodText(foodText);
  const foodId = resolveFoodText(foodText, k.foods)?.id ?? null;

  const { data: mine } = await c.from("partner_pairings").select("*").eq("merchant_id", m.id);
  const rows = (mine ?? []) as Row[];
  const existing = rows.find((r) => str(r.drink_key) === drinkKey && str(r.food_key) === foodKey) ?? null;
  const problem = partnerPairingProblem({ kind, drinkId, drinkText, foodText, note, countForDrink: rows.filter((r) => str(r.drink_key) === drinkKey).length, countTotal: rows.length, editing: !!existing });
  if (problem) throw new Error(problem);
  if (!foodKey) throw new Error("음식 이름을 한글·영문·숫자로 적어 주세요.");

  if (existing) await unlink(c, existing);

  let pairingId: number | null = null, evidenceId: number | null = null, created = false, prev: PairingSnapshot | null = null;
  if (drinkId && foodId) {
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    const name = evidenceName(m, kind);
    const { data: pairing } = await c.from("pairings").select("id,source_tier,expert_score,reason").eq("drink_id", drinkId).eq("food_id", foodId).maybeSingle();
    if (pairing) {
      prev = { tier: str(pairing.source_tier), es: Number(pairing.expert_score), reason: str(pairing.reason) };
      const next = applyPartnerPairing(prev, note, name);
      const u = await c.from("pairings").update({ source_tier: next.tier, expert_score: next.es, reason: next.reason, checked_on: today, updated_at: new Date().toISOString() }).eq("id", pairing.id);
      if (u.error) throw new Error(u.error.message);
      pairingId = Number(pairing.id);
    } else {
      const next = applyPartnerPairing(null, note, name);
      if (!drinkRow) { const { data } = await c.from("drinks").select("id,abv,profile").eq("id", drinkId).maybeSingle(); drinkRow = (data as Row | null) ?? null; }
      const { data: food } = await c.from("foods").select("profile").eq("id", foodId).maybeSingle();
      const dp = (drinkRow?.profile as DrinkProfile | null) ?? null, fp = (food?.profile as FoodProfile | null) ?? null;
      const pf = dp && fp ? profileFit(dp, drinkRow?.abv == null ? null : Number(drinkRow.abv), fp) : { s: 40, plus: [], minus: [] };
      const ins = await c.from("pairings").insert({ drink_id: drinkId, food_id: foodId, expert_score: next.es, reason: next.reason, blog_count: 0, source_tier: "official", status: "curated", profile_score: pf, checked_on: today }).select("id").single();
      if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "페어링 생성 실패");
      pairingId = Number(ins.data.id);
      created = true;
    }
    const ev = await c.from("pairing_evidence").insert({ pairing_id: pairingId, ...partnerEvidence(name, note, kind) }).select("id").single();
    if (ev.error || !ev.data) throw new Error(ev.error?.message ?? "근거 저장 실패");
    evidenceId = Number(ev.data.id);
  }
  const up = await c.from("partner_pairings").upsert({
    merchant_id: m.id, drink_id: drinkId, food_id: foodId, drink_text: drinkText, food_text: foodText, drink_key: drinkKey, food_key: foodKey, note,
    pairing_id: pairingId, evidence_id: evidenceId, created, prev, updated_at: new Date().toISOString(),
  }, { onConflict: "merchant_id,drink_key,food_key" }).select("*").single();
  if (up.error || !up.data) throw new Error(up.error?.message ?? "저장 실패");
  await bumpVersion();
  return toItem(up.data as Row, k.byId);
}

async function removeById(id: number, merchantId: string | null): Promise<void> {
  const c = need();
  let q = c.from("partner_pairings").select("*").eq("id", id);
  if (merchantId) q = q.eq("merchant_id", merchantId);
  const { data: pp } = await q.maybeSingle();
  if (!pp) throw new Error("없는 페어링이에요.");
  await unlink(c, pp as Row);
  const d = await c.from("partner_pairings").delete().eq("id", id);
  if (d.error) throw new Error(d.error.message);
  await bumpVersion();
}
export const removePartnerPairing = (m: Merchant, id: number) => removeById(id, m.id);
/** 운영자 삭제(어드민 /admin/partners) */
export const removePartnerPairingAdmin = (id: number) => removeById(id, null);

/* ---------- 공개(웹) ---------- */

export type PublicPartnerPairing = {
  id: number; merchantId: string; merchantName: string; kind: PartnerPairingKind; kakaoId: string;
  drinkId: string | null; drinkText: string; foodId: string | null; foodText: string; note: string; linked: boolean;
};

/** 승인된 양조장·식당 파트너의 추천 페어링 전부(웹이 10분 캐시로 읽는다) */
export async function publicPartnerPairings(): Promise<PublicPartnerPairing[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("partner_pairings")
    .select("id,merchant_id,drink_id,drink_text,food_id,food_text,note,evidence_id,merchants!inner(name,kind,brewery,kakao_place_id,status)")
    .eq("merchants.status", "approved").order("created_at").limit(3000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (Row & { merchants: Row })[]).flatMap((r) => {
    const m = r.merchants;
    const kind = str(m.kind) === "brewery" ? "brewery" : str(m.kind) === "restaurant" ? "restaurant" : null;
    if (!kind) return [];
    return [{
      id: Number(r.id), merchantId: str(r.merchant_id), merchantName: kind === "brewery" && m.brewery ? str(m.brewery) : str(m.name), kind, kakaoId: str(m.kakao_place_id),
      drinkId: (r.drink_id as string | null) ?? null, drinkText: str(r.drink_text), foodId: (r.food_id as string | null) ?? null, foodText: str(r.food_text), note: str(r.note), linked: !!r.evidence_id,
    }];
  });
}

/** 어드민 — 매장별 목록 */
export async function partnerPairingsByMerchant(): Promise<Map<string, PartnerPairing[]>> {
  const c = db();
  const out = new Map<string, PartnerPairing[]>();
  if (!c) return out;
  const { data } = await c.from("partner_pairings").select("*").order("created_at").limit(3000);
  const k = await catalog();
  for (const r of (data ?? []) as Row[]) { const id = str(r.merchant_id); out.set(id, [...(out.get(id) ?? []), toItem(r, k.byId)]); }
  return out;
}

export const partnerPairingLimit = PARTNER_PAIRING_MAX_PER_DRINK;

/* ---------- 빠른 입력 추천(2026-10-03) ---------- */
export type PartnerSuggestion = PairingSuggestion & { drinkId: string; drinkText: string; foodText: string };
/**
 * 파트너 페어링 화면의 추천 조합 — 양조장: 우리 술마다 카탈로그 조합(근거 + 맛 분석) 상위 n개.
 * 식당: 술 표의 술을 카탈로그에 연결하고, 메뉴판 음식과 겹치는 조합을 먼저(없으면 카탈로그 조합 그대로). 이미 적은 조합은 뺀다. 규칙은 shared suggestPairings.
 */
export async function suggestPartnerPairings(m: Merchant, perDrink = PARTNER_SUGGEST_PER_DRINK): Promise<PartnerSuggestion[]> {
  const c = db();
  if (!c) return [];
  const kind: PartnerPairingKind | null = m.kind === "brewery" ? "brewery" : m.kind === "restaurant" ? "restaurant" : null;
  if (!kind || (kind === "brewery" && !m.brewery)) return [];
  const k = await catalog();
  const { data: mine } = await c.from("partner_pairings").select("drink_id,food_id,drink_key,food_key").eq("merchant_id", m.id);
  const taken = new Set(((mine ?? []) as Row[]).filter((r) => r.drink_id && r.food_id).map((r) => `${str(r.drink_id)}|${str(r.food_id)}`));

  // 대상 술과 (식당이면) 메뉴 음식
  const targets: { drinkId: string; drinkText: string }[] = [];
  let menuFood: Map<string, string> | null = null;   // 카탈로그 food id → 메뉴판 이름
  if (kind === "brewery") {
    const { data } = await c.from("drinks").select("id,name").eq("brewery_name", m.brewery).order("name").limit(100);
    for (const r of (data ?? []) as Row[]) targets.push({ drinkId: str(r.id), drinkText: str(r.name) });
  } else {
    const { data: pi } = await c.from("place_info").select("drink_items,menu_items").eq("kakao_id", m.kakaoPlaceId).maybeSingle();
    const drinkItems = ((pi?.drink_items as { name?: string }[] | null) ?? []), menuItems = ((pi?.menu_items as { name?: string; section?: string }[] | null) ?? []);
    for (const it of drinkItems) { const name = str(it.name).trim(); const d = name ? resolveDrinkText(name, k.drinks) : null; if (d && !targets.some((t) => t.drinkId === d.id)) targets.push({ drinkId: d.id, drinkText: name }); }
    menuFood = new Map();
    for (const it of menuItems) { if (it.section && it.section !== "food") continue; const name = str(it.name).trim(); const f = name ? resolveFoodText(name, k.foods) : null; if (f && !menuFood.has(f.id)) menuFood.set(f.id, name); }
  }
  if (!targets.length) return [];
  const { data: ps } = await c.from("pairings").select("drink_id,food_id,source_tier,profile_score,reason").in("drink_id", targets.map((t) => t.drinkId)).eq("status", "curated").limit(3000);
  const byDrink = new Map<string, SuggestInput[]>();
  for (const r of (ps ?? []) as Row[]) {
    const foodId = str(r.food_id), food = k.byId.get(foodId);
    if (!food) continue;
    const s = Number((r.profile_score as { s?: unknown } | null)?.s ?? 0);
    const list = byDrink.get(str(r.drink_id)) ?? [];
    list.push({ foodId, food, src: (r.source_tier as string | null) ?? "profile", s: Number.isFinite(s) ? s : 0, reason: (r.reason as string | null) ?? "" });
    byDrink.set(str(r.drink_id), list);
  }
  const out: PartnerSuggestion[] = [];
  for (const t of targets) {
    let rows = byDrink.get(t.drinkId) ?? [];
    if (menuFood?.size) { const onMenu = rows.filter((r) => menuFood!.has(r.foodId)); if (onMenu.length) rows = onMenu; }
    const exclude = new Set([...taken].filter((x) => x.startsWith(t.drinkId + "|")).map((x) => x.slice(t.drinkId.length + 1)));
    for (const s of suggestPairings(rows, exclude, perDrink)) out.push({ ...s, drinkId: t.drinkId, drinkText: t.drinkText, foodText: menuFood?.get(s.foodId) ?? s.food });
    if (out.length >= 40) break;
  }
  return out.slice(0, 40);
}
