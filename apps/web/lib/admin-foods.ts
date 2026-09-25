/**
 * 어드민 — 음식 사진(0037, 2026-09-26). 상세 머리 카드 오른쪽 칸·검색 결과 썸네일에 쓴다.
 * 주소는 shared cleanCatalogImage(https 절대 주소·사이트 안 경로만). 저장하면 발행(catalog_meta.version)해 공개 화면이 15초 안에 본다.
 */
import { cleanCatalogImage, cleanImageCredit } from "@pairinggo/shared";
import { db } from "./db";
import { publish } from "./admin-data";

const need = () => { const sb = db(); if (!sb) throw new Error("DB 미설정"); return sb; };
export type AdminFoodRow = { id: string; name: string; category: string; imageUrl: string; imageCredit: string };

export async function listFoodsAdmin(): Promise<AdminFoodRow[]> {
  const sb = need();
  const { data, error } = await sb.from("foods").select("id,name,category,image_url,image_credit").order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: String(r.id), name: String(r.name), category: String(r.category ?? ""), imageUrl: String(r.image_url ?? ""), imageCredit: String(r.image_credit ?? "") }));
}

export async function saveFoodImage(input: { id?: unknown; imageUrl?: unknown; imageCredit?: unknown }): Promise<{ version: string; imageUrl: string; imageCredit: string }> {
  const sb = need();
  const id = String(input.id ?? "").trim();
  if (!/^f\d+$/.test(id)) throw new Error("음식 id가 올바르지 않습니다");
  const imageUrl = cleanCatalogImage(input.imageUrl);
  if (String(input.imageUrl ?? "").trim() && !imageUrl) throw new Error("사진 주소는 https://… 또는 /…만 받습니다(공백·따옴표 금지)");
  const imageCredit = imageUrl ? cleanImageCredit(input.imageCredit) : "";
  const { data, error } = await sb.from("foods").update({ image_url: imageUrl || null, image_credit: imageCredit || null, updated_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("없는 음식입니다");
  const { version } = await publish(`어드민 음식 사진 ${id}`);
  return { version, imageUrl, imageCredit };
}
