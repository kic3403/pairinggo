/**
 * 어드민 — 술 정보(주종·세부 종류·국가·원어명·별칭·주종별 속성)와 판매 규격·참고가격 편집(2026-09-24, docs/23).
 * 저장하면 catalog_meta.version을 올려(발행) 공개 화면·검색이 15초 안에 새 값을 본다. 규격은 통째로 맞추고(빠진 규격은 삭제),
 * 가격은 이력이라 고치지 않고 valid만 바꾼다(새 가격은 행 추가). 0원·0mL는 받지 않는다(cleanSpec).
 */
import { KIND_BY_ID, categoryFromInput, cleanAttrs, cleanKind, cleanPrice, cleanSpec, type DrinkKind, type SpecPrice } from "@pairinggo/shared";
import { db } from "./db";
import { publish } from "./admin-data";

const need = () => { const sb = db(); if (!sb) throw new Error("DB 미설정"); return sb; };
type Row = Record<string, unknown>;
const PAGE = 1000;
async function all(label: string, q: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const out: Row[] = [];
  for (;;) { const { data, error } = await q(out.length, out.length + PAGE - 1); if (error) throw new Error(`${label}: ${error.message}`); out.push(...(data ?? [])); if ((data ?? []).length < PAGE) return out; }
}

export type AdminDrinkListRow = { id: string; name: string; kind: DrinkKind; category: string; country: string; demo: boolean; specs: number; prices: number };
export async function listDrinksAdmin(kind: DrinkKind | "all" = "all"): Promise<AdminDrinkListRow[]> {
  const sb = need();
  const [drinks, specs, prices] = await Promise.all([
    all("drinks", (f, t) => sb.from("drinks").select("id,name,kind,category,country,is_demo").order("id").range(f, t)),
    all("drink_specs", (f, t) => sb.from("drink_specs").select("id,drink_id").range(f, t)).catch(() => [] as Row[]),
    all("drink_prices", (f, t) => sb.from("drink_prices").select("id,spec_id").eq("valid", true).range(f, t)).catch(() => [] as Row[]),
  ]);
  const specDrink = new Map(specs.map((s) => [String(s.id), String(s.drink_id)]));
  const nSpec = new Map<string, number>(), nPrice = new Map<string, number>();
  for (const s of specs) nSpec.set(String(s.drink_id), (nSpec.get(String(s.drink_id)) || 0) + 1);
  for (const p of prices) { const d = specDrink.get(String(p.spec_id)); if (d) nPrice.set(d, (nPrice.get(d) || 0) + 1); }
  return drinks
    .map((r) => ({ id: String(r.id), name: String(r.name), kind: cleanKind(r.kind), category: String(r.category ?? ""), country: String(r.country ?? "kr"), demo: !!r.is_demo, specs: nSpec.get(String(r.id)) || 0, prices: nPrice.get(String(r.id)) || 0 }))
    .filter((r) => kind === "all" || r.kind === kind)
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

export type AdminPriceRow = { id: number; krw: number; type: SpecPrice["type"]; source: string; url: string | null; checked: string; valid: boolean };
export type AdminSpecRow = { id: number; ml: number | null; abv: number | null; vintage: string | null; pack: "bottle" | "set"; bottles: number; note: string | null; prices: AdminPriceRow[] };
export type AdminDrink = {
  id: string; name: string; kind: DrinkKind; category: string; country: string; nameOrig: string; alias0: string; aliases: string[]; brewery: string; abv: number | null; demo: boolean;
  attrs: Record<string, unknown>; specs: AdminSpecRow[];
};
export async function getDrinkAdmin(id: string): Promise<AdminDrink | null> {
  const sb = need();
  const { data: r, error } = await sb.from("drinks").select("id,name,kind,category,country,name_orig,alias,brewery_name,abv,is_demo,attrs").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!r) return null;
  const { data: specs } = await sb.from("drink_specs").select("*").eq("drink_id", id).order("sort").order("id");
  const specIds = (specs ?? []).map((s) => s.id as number);
  const { data: prices } = specIds.length ? await sb.from("drink_prices").select("*").in("spec_id", specIds).order("id") : { data: [] as Row[] };
  const alias: string[] = (r.alias as string[] | null) ?? [];
  return {
    id: String(r.id), name: String(r.name), kind: cleanKind(r.kind), category: String(r.category ?? ""), country: String(r.country ?? "kr"), nameOrig: String(r.name_orig ?? ""),
    alias0: alias[0] ?? "", aliases: alias.slice(1), brewery: String(r.brewery_name ?? ""), abv: r.abv == null ? null : Number(r.abv), demo: !!r.is_demo,
    attrs: (r.attrs as Record<string, unknown> | null) ?? {},
    specs: (specs ?? []).map((s) => ({
      id: Number(s.id), ml: s.volume_ml == null ? null : Number(s.volume_ml), abv: s.abv == null ? null : Number(s.abv), vintage: (s.vintage as string | null) ?? null,
      pack: s.pack === "set" ? "set" : "bottle", bottles: Number(s.bottles ?? 1), note: (s.note as string | null) ?? null,
      prices: (prices ?? []).filter((p) => Number(p.spec_id) === Number(s.id)).map((p) => ({ id: Number(p.id), krw: Number(p.krw), type: p.price_type === "msrp" ? "msrp" : "retail", source: String(p.source ?? ""), url: (p.source_url as string | null) ?? null, checked: String(p.checked_on).slice(0, 10), valid: p.valid !== false })),
    })),
  };
}

export type SaveInput = {
  id: string; kind: string; subtype: string; category: string; country: string; nameOrig: string; aliases: string; attrs: Record<string, unknown>;
  specs: { id?: number | null; ml: unknown; abv: unknown; vintage: unknown; pack: unknown; bottles: unknown; note: unknown; prices: { id?: number | null; krw?: unknown; type?: unknown; source?: unknown; url?: unknown; checked?: unknown; valid?: unknown }[] }[];
};
/** 저장 + 발행 — 검증에 걸리면 아무것도 쓰지 않는다 */
export async function saveDrinkAdmin(input: SaveInput): Promise<{ version: string; problems: string[] }> {
  const sb = need();
  const id = String(input.id ?? "").trim();
  if (!/^d\d+$/.test(id)) throw new Error("술 id가 올바르지 않습니다");
  const cur = await getDrinkAdmin(id);
  if (!cur) throw new Error("없는 술입니다");
  const kind = cleanKind(input.kind);
  const category = categoryFromInput(kind, String(input.subtype ?? ""), String(input.category ?? ""));
  if (kind === "trad" && !category) throw new Error("전통주 종류를 골라 주세요");
  const country = KIND_BY_ID[kind].countries.some((c) => c.id === input.country) ? String(input.country) : KIND_BY_ID[kind].countries[0].id;
  const attrs = cleanAttrs(kind, input.attrs);
  const nameOrig = String(input.nameOrig ?? "").trim().slice(0, 120) || null;
  const extra = String(input.aliases ?? "").split(/[,\n]/).map((s) => s.trim().slice(0, 60)).filter(Boolean);
  const alias = [...new Set([cur.alias0 || cur.name, ...extra])];
  const problems: string[] = [];
  // 규격 — 새 가격은 cleanPrice로, 기존 가격은 valid만
  const specs = (Array.isArray(input.specs) ? input.specs : []).map((s, i) => {
    const c = cleanSpec({ ml: s.ml, abv: s.abv, vintage: s.vintage, pack: s.pack, bottles: s.bottles, note: s.note, prices: [] });
    if (s.ml !== "" && s.ml != null && c.ml == null) problems.push(`규격 ${i + 1}: 용량 '${String(s.ml)}'을 읽을 수 없어 미확인으로 둡니다(0 금지)`);
    const prices = (Array.isArray(s.prices) ? s.prices : []).map((p, j) => {
      if (p.id) return { id: Number(p.id), valid: p.valid !== false && p.valid !== "0" && p.valid !== "false" };
      const cp = cleanPrice({ krw: p.krw, type: p.type, source: p.source, url: p.url, checked: p.checked });
      if (!cp) { if (p.krw || p.source) problems.push(`규격 ${i + 1} 가격 ${j + 1}: 금액(0 금지)·출처·확인일(YYYY-MM-DD)이 다 있어야 넣습니다 — 건너뜀`); return null; }
      return { ...cp };
    }).filter((p): p is NonNullable<typeof p> => !!p);
    return { ...c, id: s.id ? Number(s.id) : null, prices };
  });
  const up = await sb.from("drinks").update({ kind, category, country, attrs, name_orig: nameOrig, alias, online_sellable: kind === "trad", updated_at: new Date().toISOString() }).eq("id", id);
  if (up.error) throw new Error(up.error.message);
  // 빠진 규격 삭제(가격은 cascade)
  const keep = new Set(specs.map((s) => s.id).filter((x): x is number => x != null));
  const gone = cur.specs.map((s) => s.id).filter((x) => !keep.has(x));
  if (gone.length) { const d = await sb.from("drink_specs").delete().in("id", gone); if (d.error) throw new Error(d.error.message); }
  let sort = 0;
  for (const s of specs) {
    const row = { drink_id: id, volume_ml: s.ml, abv: s.abv ?? null, vintage: s.vintage ?? null, pack: s.pack, bottles: s.bottles, note: s.note ?? null, sort: sort++, updated_at: new Date().toISOString() };
    let specId = s.id;
    if (specId) { const u = await sb.from("drink_specs").update(row).eq("id", specId); if (u.error) throw new Error(u.error.message); }
    else { const ins = await sb.from("drink_specs").insert(row).select("id").single(); if (ins.error) throw new Error(ins.error.message); specId = Number(ins.data.id); }
    for (const p of s.prices) {
      if ("id" in p && p.id) { const u = await sb.from("drink_prices").update({ valid: p.valid }).eq("id", p.id).eq("spec_id", specId); if (u.error) throw new Error(u.error.message); }
      else if ("krw" in p) { const ins = await sb.from("drink_prices").insert({ spec_id: specId, krw: p.krw, price_type: p.type, source: p.source, source_url: p.url ?? null, checked_on: p.checked }); if (ins.error) throw new Error(ins.error.message); }
    }
  }
  const { version } = await publish(`어드민 술 정보 수정 ${id}`);
  return { version, problems };
}
