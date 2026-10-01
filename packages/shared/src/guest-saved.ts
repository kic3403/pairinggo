/**
 * 비로그인 저장(2026-10-01) — 하트를 누르면 로그인으로 보내지 않고 기기(localStorage)에 먼저 담는다.
 * 로그인하면 SavedProvider가 계정으로 옮기고(`POST /api/saved/merge`, 이미 있는 것은 그대로) 기기 목록을 비운다.
 * 이 파일은 저장 형식·토글·정리 규칙만(브라우저 API 없음).
 */
export type GuestSavedKind = "drink" | "food" | "place";
export type GuestSavedMeta = { name?: string; address?: string; phone?: string; url?: string; category?: string; food?: string };
/** name은 기기 목록 화면(/saved)에 보여 줄 이름 — 술·음식은 하트가 넘겨 주고, 음식점은 meta.name */
export type GuestSavedItem = { kind: GuestSavedKind; id: string; name?: string; meta?: GuestSavedMeta; at: number };

export const GUEST_SAVED_KEY = "pg_guest_saved";
/** 기기에 담아 두는 최대 개수 — 넘치면 오래된 것부터 뺀다 */
export const GUEST_SAVED_MAX = 50;

const KINDS = new Set<GuestSavedKind>(["drink", "food", "place"]);
const META_KEYS = ["name", "address", "phone", "url", "category", "food"] as const;
const META_MAX: Record<(typeof META_KEYS)[number], number> = { name: 120, address: 200, phone: 40, url: 300, category: 80, food: 60 };

function cleanMeta(m: unknown): GuestSavedMeta | undefined {
  if (!m || typeof m !== "object") return undefined;
  const out: GuestSavedMeta = {};
  for (const k of META_KEYS) {
    const v = (m as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, META_MAX[k]);
  }
  return Object.keys(out).length ? out : undefined;
}

const cleanName = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : undefined);

/** 기기에 남은 글자 → 목록. 형식이 틀린 줄은 버리고, 같은 항목은 하나만, 최근 것부터 GUEST_SAVED_MAX개 */
export function parseGuestSaved(raw: string | null | undefined): GuestSavedItem[] {
  if (!raw) return [];
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: GuestSavedItem[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const { kind, id, at } = x as Record<string, unknown>;
    if (typeof kind !== "string" || !KINDS.has(kind as GuestSavedKind)) continue;
    if (typeof id !== "string" || !id || id.length > 80) continue;
    const k = `${kind}:${id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const meta = kind === "place" ? cleanMeta((x as Record<string, unknown>).meta) : undefined;
    const name = cleanName((x as Record<string, unknown>).name);
    out.push({ kind: kind as GuestSavedKind, id, ...(name ? { name } : {}), ...(meta ? { meta } : {}), at: typeof at === "number" && Number.isFinite(at) ? at : 0 });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, GUEST_SAVED_MAX);
}

/** 누른 항목을 넣거나 뺀다 — 새 목록과 바뀐 뒤 상태 */
export function toggleGuestSaved(list: GuestSavedItem[], kind: GuestSavedKind, id: string, meta: GuestSavedMeta | undefined, now: number, name?: string): { list: GuestSavedItem[]; saved: boolean } {
  const rest = list.filter((x) => !(x.kind === kind && x.id === id));
  if (rest.length < list.length) return { list: rest, saved: false };
  const m = kind === "place" ? cleanMeta(meta) : undefined;
  const nm = cleanName(name);
  return { list: [{ kind, id, ...(nm ? { name: nm } : {}), ...(m ? { meta: m } : {}), at: now }, ...rest].slice(0, GUEST_SAVED_MAX), saved: true };
}

/** 계정으로 옮길 것 — 계정에 이미 있는 항목은 뺀다(`has`는 "kind:id") */
export function guestToMerge(list: GuestSavedItem[], accountKeys: Set<string>): GuestSavedItem[] {
  return list.filter((x) => !accountKeys.has(`${x.kind}:${x.id}`));
}

/** 기기 목록 화면에 보일 이름 — 없으면(옛 기록) 빈 글자 */
export const guestSavedName = (x: GuestSavedItem) => x.name || x.meta?.name || "";
