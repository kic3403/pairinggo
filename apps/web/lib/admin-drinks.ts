/**
 * 어드민 — 술 정보(주종·세부 종류·국가·원어명·별칭·주종별 속성)와 판매 규격·참고가격 편집(2026-09-24, docs/23).
 * 저장하면 catalog_meta.version을 올려(발행) 공개 화면·검색이 15초 안에 새 값을 본다. 규격은 통째로 맞추고(빠진 규격은 삭제),
 * 가격은 이력이라 고치지 않고 valid만 바꾼다(새 가격은 행 추가). 0원·0mL는 받지 않는다(cleanSpec).
 */
import { KIND_BY_ID, PROFILE_KEYS, categoryAffinity, categoryAverageProfile, isUnknownLevel, profileUnknown, type DrinkProfile, categoryFromInput, choseong, cleanAttrs, cleanCatalogImage, cleanImageCredit, cleanKind, cleanNewDrink, cleanPrice, cleanSpec, isSmartstoreUrl, normalize, pageShowsDrink, planPairings, toSlug, type DrinkKind, type SpecPrice } from "@pairinggo/shared";
import { revalidatePath } from "next/cache";
import { getCatalog } from "./catalog";
/** DB slug 칸 — packages/db catalog-write.ts slug()와 같은 규칙 */
const slugOf = (s: string) => normalize(s).replace(/[^a-z0-9가-힣]/g, "");
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
  /** 공식 사진 주소·출처(0009) — 비어 있으면 파트너 매장 사진 폴백 또는 주종 색 타일 */
  imageUrl: string; imageCredit: string;
  /** 맛 프로필 1~5, null = 모름(attrs.profile_unknown) 또는 프로필 없음(hasProfile false) */
  profile: Record<(typeof PROFILE_KEYS)[number], number | null>; hasProfile: boolean;
};
export async function getDrinkAdmin(id: string): Promise<AdminDrink | null> {
  const sb = need();
  const { data: r, error } = await sb.from("drinks").select("id,name,kind,category,country,name_orig,alias,brewery_name,abv,is_demo,attrs,image_url,image_credit,profile").eq("id", id).maybeSingle();
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
    imageUrl: String(r.image_url ?? ""), imageCredit: String(r.image_credit ?? ""),
    ...(() => {
      const p = (r.profile as Record<string, unknown> | null) ?? null;
      const unk = profileUnknown(r.attrs as Record<string, unknown> | null);
      return { hasProfile: !!p, profile: Object.fromEntries(PROFILE_KEYS.map((k) => [k, !p || unk.includes(k) || p[k] == null ? null : Number(p[k])])) as AdminDrink["profile"] };
    })(),
    specs: (specs ?? []).map((s) => ({
      id: Number(s.id), ml: s.volume_ml == null ? null : Number(s.volume_ml), abv: s.abv == null ? null : Number(s.abv), vintage: (s.vintage as string | null) ?? null,
      pack: s.pack === "set" ? "set" : "bottle", bottles: Number(s.bottles ?? 1), note: (s.note as string | null) ?? null,
      prices: (prices ?? []).filter((p) => Number(p.spec_id) === Number(s.id)).map((p) => ({ id: Number(p.id), krw: Number(p.krw), type: p.price_type === "msrp" ? "msrp" : "retail", source: String(p.source ?? ""), url: (p.source_url as string | null) ?? null, checked: String(p.checked_on).slice(0, 10), valid: p.valid !== false })),
    })),
  };
}

export type SaveInput = {
  id: string; kind: string; subtype: string; category: string; country: string; nameOrig: string; aliases: string; attrs: Record<string, unknown>;
  imageUrl?: unknown; imageCredit?: unknown;
  /** 맛 프로필 — 축마다 1~5 또는 null(모름). 보내지 않으면 그대로 */
  profile?: Record<string, unknown>;
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
  // 맛 프로필(2026-09-29) — '모름' 축은 같은 종류(자기 빼고) 평균을 넣고 attrs.profile_unknown에 적는다. 프로필이 없던 술을 전부 모름으로 두면 그대로 없음
  let profile: DrinkProfile | null | undefined;
  delete attrs.profile_unknown;
  if (input.profile && typeof input.profile === "object") {
    const raw = input.profile as Record<string, unknown>;
    const unknown = PROFILE_KEYS.filter((k) => isUnknownLevel(raw[k]));
    if (unknown.length === PROFILE_KEYS.length && !cur.hasProfile) profile = undefined;
    else {
      const c = await getCatalog();
      const avg = categoryAverageProfile(c.dataset.drinks.filter((x) => x.id !== id), category);
      profile = Object.fromEntries(PROFILE_KEYS.map((k) => [k, Math.min(5, Math.max(1, Math.round(unknown.includes(k) ? avg[k] : Number(raw[k]) || 3)))])) as DrinkProfile;
      if (unknown.length) attrs.profile_unknown = unknown;
    }
  } else if (cur.hasProfile) {
    const keep = PROFILE_KEYS.filter((k) => cur.profile[k] == null);
    if (keep.length) attrs.profile_unknown = keep;
  }
  const nameOrig = String(input.nameOrig ?? "").trim().slice(0, 120) || null;
  const extra = String(input.aliases ?? "").split(/[,\n]/).map((s) => s.trim().slice(0, 60)).filter(Boolean);
  const alias = [...new Set([cur.alias0 || cur.name, ...extra])];
  const problems: string[] = [];
  // 사진 — https 절대 주소 또는 사이트 안 경로만(shared cleanCatalogImage). 잘못된 주소는 비우고 알린다
  const imageUrl = cleanCatalogImage(input.imageUrl);
  if (String(input.imageUrl ?? "").trim() && !imageUrl) problems.push("사진 주소는 https://… 또는 /…만 받습니다 — 비웠습니다");
  const imageCredit = imageUrl ? cleanImageCredit(input.imageCredit) : "";
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
  const up = await sb.from("drinks").update({ kind, category, country, attrs, name_orig: nameOrig, alias, image_url: imageUrl || null, image_credit: imageCredit || null, online_sellable: kind === "trad", ...(profile ? { profile } : {}), updated_at: new Date().toISOString() }).eq("id", id);
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

/* ---------- 새 술 등록(2026-09-29 사용자 요청 — '없는 술' 요청을 그 자리에서 카탈로그에 넣는다) ---------- */

export type NewDrinkResult = { id: string; name: string; slug: string; pairings: number; buyChecked: "none" | "smartstore" | "shown" | "forced" };

/**
 * 새 술 만들기 + 발행. 판매처는 운영자가 넣은 주소 — 스마트스토어가 아니면 첫 화면에 그 술 이름이 보여야 한다(2026-09-24 사용자 규칙).
 * 안 보이면 오류로 멈추고, 운영자가 확인했다며 force로 다시 보내면 넣는다. 맛 분석 추정 페어링 8개를 함께 만든다(add-drinks와 같은 규칙).
 */
export async function createDrinkAdmin(raw: Record<string, unknown>): Promise<NewDrinkResult> {
  const sb = need();
  const c = await getCatalog();
  // '모름'으로 둔 맛 축은 같은 종류 평균으로 계산하고(페어링), 화면에는 '모름'으로(attrs.profile_unknown)
  const v = cleanNewDrink(raw, categoryAverageProfile(c.dataset.drinks, String(raw.category ?? "")));
  if (!v.ok) throw new Error(v.problem);
  const d = v.value;
  const key = slugOf(d.name);
  // 같은 술 막기 — DB slug(데모·숨은 술 포함) + 카탈로그 이름·별칭(띄어쓰기 무시)
  const { data: same } = await sb.from("drinks").select("id,name").eq("slug", key).limit(1);
  const hit = same?.[0] ?? c.dataset.drinks.find((x) => [x.name, ...(Array.isArray(x.alias) ? x.alias : [])].some((n) => slugOf(String(n)) === key));
  if (hit) throw new Error(`이미 카탈로그에 있어요 — ${hit.name}(${hit.id}). '이미 있는 술이면 연결'을 써 주세요`);
  // 판매처 확인
  let buyChecked: NewDrinkResult["buyChecked"] = "none";
  if (d.buyUrl) {
    if (isSmartstoreUrl(d.buyUrl)) buyChecked = "smartstore";
    else {
      const html = await fetch(d.buyUrl, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Mozilla/5.0 (pairinggo link check)" } }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
      if (pageShowsDrink(html, [d.name])) buyChecked = "shown";
      else if (raw.force === true) buyChecked = "forced";
      else throw new Error("판매처 첫 화면에서 이 술 이름을 찾지 못했어요 — 상품 페이지 주소가 맞는지 확인하고, 맞으면 '그래도 저장'을 눌러 주세요");
    }
  }
  // 새 id — 가장 큰 번호 다음
  const ids = await all("drinks", (f, t) => sb.from("drinks").select("id").order("id").range(f, t));
  const next = Math.max(0, ...ids.map((r) => Number(String(r.id).replace(/^d/, "")) || 0)) + 1;
  const id = `d${next}`;
  const foods = c.dataset.foods.map((f) => ({ id: f.id, name: f.name, category: f.category, profile: f.profile, trend: f.trend }));
  const planned = planPairings({ profile: d.profile, abv: d.abv, unknown: d.profileUnknown }, foods, [], { total: 8, perCategory: 2, maxOfficial: 0 }, undefined, categoryAffinity(c.dataset.pairings, c.dataset.drinks, d.category));
  const alias = [...new Set([d.name, d.brewery].filter(Boolean))];
  const ins = await sb.from("drinks").insert({
    id, slug: key, name: d.name, alias, chosung: choseong(d.name.replace(/\s+/g, "")), category: d.category, abv: d.abv, region: d.region, brewery_name: d.brewery,
    description: d.desc, flavor_tags: [], profile: d.profile, awards: [], is_generic: false, online_sellable: true, buy_url: d.buyUrl, buy_store: d.buyStore,
    offline: null, trend: null, blog_anju: 0, kind: "trad", country: "kr", attrs: d.profileUnknown.length ? { profile_unknown: d.profileUnknown } : {}, is_demo: false, updated_at: new Date().toISOString(),
  });
  if (ins.error) throw new Error(ins.error.message);
  if (planned.length) {
    const p = await sb.from("pairings").insert(planned.map((x) => ({ drink_id: id, food_id: x.f, expert_score: x.es, reason: x.reason, blog_count: 0, source_tier: x.src, status: "curated", profile_score: x.pf, updated_at: new Date().toISOString() })));
    if (p.error) throw new Error(`술은 넣었지만 추정 페어링을 넣지 못했어요: ${p.error.message}`);
  }
  await publish(`어드민 새 술 등록 — ${d.name}(${id})`);
  try { revalidatePath("/drinks"); revalidatePath("/drinks/[slug]", "page"); revalidatePath("/sitemap.xml"); } catch { /* */ }
  return { id, name: d.name, slug: toSlug(d.name), pairings: planned.length, buyChecked };
}
