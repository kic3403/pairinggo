/** 저장(찜) — 로그인 사용자별 술·음식 목록. service_role로만 접근한다. */
import { db } from "./db";

export type SavedKind = "drink" | "food";
export type SavedRow = { kind: SavedKind; item_id: string; created_at: string };

const need = () => { const sb = db(); if (!sb) throw new Error("Supabase 미설정 — 저장 기능은 DB가 필요합니다"); return sb; };

export async function listSaved(userId: string): Promise<SavedRow[]> {
  const { data, error } = await need().from("saved_items").select("kind,item_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data || []) as SavedRow[];
}

export async function isSaved(userId: string, kind: SavedKind, itemId: string): Promise<boolean> {
  const { count, error } = await need().from("saved_items").select("item_id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).eq("item_id", itemId);
  if (error) throw new Error(error.message);
  return (count || 0) > 0;
}

/** 저장/해제 토글 — 바뀐 뒤 상태를 돌려준다 */
export async function toggleSaved(userId: string, kind: SavedKind, itemId: string): Promise<boolean> {
  const sb = need();
  if (await isSaved(userId, kind, itemId)) {
    const { error } = await sb.from("saved_items").delete().eq("user_id", userId).eq("kind", kind).eq("item_id", itemId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await sb.from("saved_items").insert({ user_id: userId, kind, item_id: itemId });
  if (error) throw new Error(error.message);
  return true;
}
