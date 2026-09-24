/**
 * 매장 메뉴판(2026-09-19 사용자 요청) — 파트너 앱에서 메뉴판 사진을 올리면 AI가 읽어 표로 채운다.
 *   메뉴: 음식명 · 간단한 설명 · 가격        술: 술 이름 · 용량 · 도수 · 가격
 * 적혀 있지 않은 칸은 빈칸(설명 "" / 가격·도수 null / 용량 "")으로 두고 화면에도 빈칸으로 보인다 — 지어내지 않는다.
 * 저장은 place_info.menu_items·drink_items(0024). 카탈로그 연결 목록(food_ids·menu_names·drink_ids·drink_names)은 표에서 뽑는다.
 */
import { addListItem } from "./place-info";
import { isKnownCategory } from "./catalog/kinds";

/** img: 사장님이 올린 사진(우리 저장소 menu-photos 공개 주소만, 없으면 속성 자체가 없음 — 2026-09-19) */
export type MenuItem = { name: string; desc: string; price: number | null; img?: string };
/** category: 술 종류 저장값(catalog/kinds.ts categoryOptions — 탁주·싱글몰트·준마이…, 2026-09-25). 모르면 없음 */
export type DrinkItem = { name: string; volume: string; abv: number | null; price: number | null; desc?: string; img?: string; category?: string };

/** 메뉴 사진 저장소(Supabase Storage 공개 버킷) — 경로는 {매장 id}/{파일} */
export const MENU_PHOTO_BUCKET = "menu-photos";
const MENU_PHOTO_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/menu-photos\/[A-Za-z0-9-]{1,64}\/[A-Za-z0-9_-]{1,80}\.(?:jpg|jpeg|png|webp)$/;
/** 메뉴 사진 주소 — 우리 저장소 공개 주소만 받는다(다른 사이트 사진·스크립트 주소 차단). 아니면 "" */
export const cleanMenuImage = (v: unknown): string => { const s = String(v ?? "").trim(); return s.length <= 300 && MENU_PHOTO_URL.test(s) ? s : ""; };
/** 표에 쓰인 사진 주소들(저장소 정리 때 지우지 않을 것) */
export const menuImages = (menu: { img?: string }[], drinks: { img?: string }[]): string[] => [...menu, ...drinks].map((x) => x.img ?? "").filter(Boolean);

export const MENU_ITEMS_MAX = 80, MENU_NAME_MAX = 40, MENU_DESC_MAX = 60, DRINK_VOLUME_MAX = 20, PRICE_MAX = 10_000_000;

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const hasLink = (s: string) => /https?:|www\./i.test(s);
const key = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 가격 — 숫자, "12,000원", "1.2만", "3만5천" → 원. "시가"·"변동"·빈칸·범위 밖 → null */
export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 && v <= PRICE_MAX ? Math.round(v) : null;
  const s = String(v ?? "").replace(/[\s,₩원]/g, "");
  if (!s) return null;
  const man = s.match(/^(\d+(?:\.\d+)?)만(?:(\d+)천)?$/);
  if (man) return parsePrice(Number(man[1]) * 10000 + (man[2] ? Number(man[2]) * 1000 : 0));
  const cheon = s.match(/^(\d+(?:\.\d+)?)천$/);
  if (cheon) return parsePrice(Number(cheon[1]) * 1000);
  return /^\d+(\.\d+)?$/.test(s) ? parsePrice(Number(s)) : null;
}

/** 도수 — 13, "13%", "13도", "6.5 %" → 숫자(소수 한 자리). 0~80 밖이면 null */
export function parseAbv(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[\s%도]/g, ""));
  if (!Number.isFinite(n) || String(v ?? "").trim() === "" || n < 0 || n > 80) return null;
  return Math.round(n * 10) / 10;
}

/** 용량 — "750ML" → "750ml", "1.8 L" → "1.8L", "잔"·"1병"·"500cc"는 그대로 */
export function cleanVolume(v: unknown): string {
  return text(v, DRINK_VOLUME_MAX).replace(/(\d)\s*(ml|ML|mL|Ml)\b/g, "$1ml").replace(/(\d)\s*[lL]\b/g, "$1L").replace(/(\d)\s*(cc|CC)\b/g, "$1cc");
}

export const formatPrice = (n: number | null | undefined) => (n == null ? "" : `${n.toLocaleString("ko-KR")}원`);
export const formatAbv = (n: number | null | undefined) => (n == null ? "" : `${n}%`);

/**
 * 표에서 한 줄을 위·아래로 한 칸 옮긴다 (2026-09-22 사용자 요청 — 파트너가 메뉴·술 차례를 정한다).
 * 손님 화면 메뉴판은 저장된 차례 그대로 보여 준다. 끝에서 더 가면 그대로 둔다.
 */
export function moveItem<T>(rows: readonly T[], from: number, step: number): T[] {
  const to = from + step;
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length) return [...rows];
  const out = [...rows];
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}

export function cleanMenuItems(raw: unknown): MenuItem[] {
  const out: MenuItem[] = [], seen = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r ?? {}) as Record<string, unknown>;
    const name = text(o.name, MENU_NAME_MAX), desc = text(o.desc, MENU_DESC_MAX);
    if (!name || seen.has(key(name)) || hasLink(name) || hasLink(desc)) continue;
    seen.add(key(name));
    const img = cleanMenuImage(o.img);
    out.push({ name, desc, price: parsePrice(o.price), ...(img ? { img } : {}) });
    if (out.length >= MENU_ITEMS_MAX) break;
  }
  return out;
}

export function cleanDrinkItems(raw: unknown): DrinkItem[] {
  const out: DrinkItem[] = [], seen = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r ?? {}) as Record<string, unknown>;
    const name = text(o.name, MENU_NAME_MAX), volume = cleanVolume(o.volume), desc = text(o.desc, MENU_DESC_MAX);
    // 같은 술이 용량별로 여러 줄일 수 있다(잔·병) — 이름+용량이 같을 때만 겹친 것으로 본다
    const k = `${key(name)}|${key(volume)}`;
    if (!name || seen.has(k) || hasLink(name) || hasLink(desc)) continue;
    seen.add(k);
    const img = cleanMenuImage(o.img);
    // 설명은 양조장·리쿼샵이 술을 소개할 때 쓴다(2026-09-21) — 식당 메뉴판에서는 비어 있어도 된다
    const category = isKnownCategory(o.category) ? o.category : "";
    out.push({ name, volume, abv: parseAbv(o.abv), price: parsePrice(o.price), ...(desc ? { desc } : {}), ...(img ? { img } : {}), ...(category ? { category } : {}) });
    if (out.length >= MENU_ITEMS_MAX) break;
  }
  return out;
}

/** AI가 메뉴판에서 읽은 한 줄 — kind·이름·카탈로그 이름에 더해 설명·가격·용량·도수(없으면 빈값) */
export type MenuReadRow = { kind: "drink" | "food"; name: string; catalogName: string | null; desc?: string; price?: number | null; volume?: string; abv?: number | null };

/**
 * 읽은 줄을 지금 표에 더한다 — 지우거나 덮지 않는다. 같은 이름(술은 이름+용량)이 이미 있으면 빈칸만 채운다.
 * 카탈로그와 분명히 같은 것(catalogName이 실제 카탈로그 이름)이면 카탈로그 이름으로 적어 페어링GO 페이지로 이어지게 한다.
 */
export function mergeMenuRows(
  current: { menu: MenuItem[]; drinks: DrinkItem[] },
  rows: MenuReadRow[],
  catalog: { drinks: { name: string }[]; foods: { name: string }[] },
): { menu: MenuItem[]; drinks: DrinkItem[]; added: number; filled: number } {
  const menu = current.menu.map((m) => ({ ...m })), drinks = current.drinks.map((d) => ({ ...d }));
  let added = 0, filled = 0;
  const named = (name: string, catalogName: string | null, list: { name: string }[]) =>
    (catalogName && list.find((c) => key(c.name) === key(catalogName))?.name) || name;
  for (const r of rows) {
    if (r.kind === "food") {
      const [it] = cleanMenuItems([{ name: named(r.name, r.catalogName, catalog.foods), desc: r.desc, price: r.price }]);
      if (!it) continue;
      const ex = menu.find((m) => key(m.name) === key(it.name));
      if (!ex) { if (menu.length < MENU_ITEMS_MAX) { menu.push(it); added++; } continue; }
      if (!ex.desc && it.desc) { ex.desc = it.desc; filled++; }
      if (ex.price == null && it.price != null) { ex.price = it.price; filled++; }
    } else {
      const [it] = cleanDrinkItems([{ name: named(r.name, r.catalogName, catalog.drinks), volume: r.volume, abv: r.abv, price: r.price, desc: r.desc }]);
      if (!it) continue;
      const ex = drinks.find((d) => key(d.name) === key(it.name) && (key(d.volume) === key(it.volume) || !d.volume || !it.volume));
      if (!ex) { if (drinks.length < MENU_ITEMS_MAX) { drinks.push(it); added++; } continue; }
      if (!ex.desc && it.desc) { ex.desc = it.desc; filled++; }
      if (!ex.volume && it.volume) { ex.volume = it.volume; filled++; }
      if (ex.abv == null && it.abv != null) { ex.abv = it.abv; filled++; }
      if (ex.price == null && it.price != null) { ex.price = it.price; filled++; }
    }
  }
  return { menu, drinks, added, filled };
}

/** 표 → 카탈로그 연결 목록(식당 카드의 "술 · 메뉴" 줄과 페어링GO 페이지 링크) */
export function itemsToLists(menu: MenuItem[], drinks: DrinkItem[], catalog: { drinks: { id: string; name: string }[]; foods: { id: string; name: string }[] }) {
  let d = { ids: [] as string[], names: [] as string[] }, f = { ids: [] as string[], names: [] as string[] };
  for (const x of drinks) { const r = addListItem(d, x.name, catalog.drinks); d = { ids: r.ids, names: r.names }; }
  for (const x of menu) { const r = addListItem(f, x.name, catalog.foods); f = { ids: r.ids, names: r.names }; }
  return { drinkIds: d.ids, drinkNames: d.names, foodIds: f.ids, menuNames: f.names };
}
