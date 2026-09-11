/**
 * 저장(찜) — 로그인 사용자별 전통주·음식·음식점 목록. service_role로만 접근한다.
 * 음식점은 카탈로그에 없고 카카오 로컬에서 오므로 표시에 필요한 값을 meta에 함께 저장한다.
 */
import { db } from "./db";

export type SavedKind = "drink" | "food" | "place";
export const SAVED_KINDS: SavedKind[] = ["drink", "food", "place"];
export const KIND_LABEL: Record<SavedKind, string> = { drink: "전통주", food: "음식", place: "음식점" };

export type PlaceMeta = { name?: string; address?: string; phone?: string; url?: string; category?: string; food?: string };
export type SavedRow = { kind: SavedKind; item_id: string; created_at: string; meta: PlaceMeta | null };

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정 — 저장 기능은 DB가 필요합니다"); return sb; };

export async function listSaved(userId: string): Promise<SavedRow[]> {
  const { data, error } = await need()
    .from("saved_items").select("kind,item_id,created_at,meta")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data || []) as SavedRow[];
}

/** 여러 항목의 저장 여부를 한 번에 — 목록 화면에서 N번 조회하지 않으려고 */
export async function savedKeys(userId: string): Promise<Set<string>> {
  const rows = await listSaved(userId);
  return new Set(rows.map((r) => `${r.kind}:${r.item_id}`));
}

export async function isSaved(userId: string, kind: SavedKind, itemId: string): Promise<boolean> {
  const { count, error } = await need().from("saved_items").select("item_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("kind", kind).eq("item_id", itemId);
  if (error) throw new Error(error.message);
  return (count || 0) > 0;
}

/** 저장/해제 토글 — 바뀐 뒤 상태를 돌려준다 */
export async function toggleSaved(userId: string, kind: SavedKind, itemId: string, meta?: PlaceMeta | null): Promise<boolean> {
  const sb = need();
  if (await isSaved(userId, kind, itemId)) {
    const { error } = await sb.from("saved_items").delete().eq("user_id", userId).eq("kind", kind).eq("item_id", itemId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await sb.from("saved_items").insert({ user_id: userId, kind, item_id: itemId, meta: kind === "place" ? meta ?? null : null });
  if (error) throw new Error(error.message);
  return true;
}
