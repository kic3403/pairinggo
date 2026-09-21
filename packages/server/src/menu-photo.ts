/**
 * 메뉴·술 사진·매장 대표 사진(2026-09-19) — 파트너가 표의 한 줄에 붙이는 사진과 매장 상세 맨 위 사진(최대 10장). Supabase Storage 공개 버킷 menu-photos/{매장 id}/{시각-난수}.jpg
 * 브라우저에서 긴 변 800px JPEG로 줄여 보내고(image-client shrinkToJpeg), 여기서는 JPEG인지·크기만 확인해 올린다.
 * 표에서 빠진 사진은 바로 지우지 않는다 — 운영자가 변경 이력으로 되돌릴 수 있게 30일 둔 뒤 아침 크론이 정리(cleanupMenuPhotos).
 */
import { randomBytes } from "node:crypto";
import { MENU_PHOTO_BUCKET, cleanDrinkItems, cleanMenuItems, cleanStorePhotos, menuImages } from "@pairinggo/shared";
import { db } from "./db";

export const MENU_PHOTO_MAX_BYTES = 1_000_000, MENU_PHOTO_MAX_PER_STORE = 400, MENU_PHOTO_KEEP_DAYS = 30;

const need = () => { const c = db(); if (!c) throw new Error("지금은 사진을 올릴 수 없어요"); return c; };

/** base64 JPEG 한 장 → 공개 주소 */
export async function uploadMenuPhoto(merchantId: string, base64: string): Promise<string> {
  const c = need();
  const buf = Buffer.from(String(base64 ?? ""), "base64");
  if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw new Error("사진(JPG)만 올릴 수 있어요");
  if (buf.length > MENU_PHOTO_MAX_BYTES) throw new Error("사진이 너무 커요 — 1MB까지예요");
  const { data: files } = await c.storage.from(MENU_PHOTO_BUCKET).list(merchantId, { limit: MENU_PHOTO_MAX_PER_STORE + 1 });
  if ((files?.length ?? 0) >= MENU_PHOTO_MAX_PER_STORE) throw new Error("사진이 너무 많아요 — 안 쓰는 사진은 30일 뒤 정리돼요");
  const path = `${merchantId}/${Date.now()}-${randomBytes(4).toString("hex")}.jpg`;
  const put = () => c.storage.from(MENU_PHOTO_BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
  let { error } = await put();
  if (error && /not found|bucket/i.test(error.message)) {
    await c.storage.createBucket(MENU_PHOTO_BUCKET, { public: true, fileSizeLimit: MENU_PHOTO_MAX_BYTES, allowedMimeTypes: ["image/jpeg"] }).catch(() => null);
    ({ error } = await put());
  }
  if (error) throw new Error("사진을 올리지 못했어요 — 잠시 뒤 다시 시도해 주세요");
  return c.storage.from(MENU_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 표에 없는 사진 중 30일 지난 것 정리 — 아침 크론. 지운 개수 */
export async function cleanupMenuPhotos(now = Date.now()): Promise<number> {
  const c = db();
  if (!c) return 0;
  const { data: folders } = await c.storage.from(MENU_PHOTO_BUCKET).list("", { limit: 1000 });
  if (!folders?.length) return 0;
  const cutoff = now - MENU_PHOTO_KEEP_DAYS * 86400_000;
  let removed = 0;
  for (const f of folders) {
    const merchantId = f.name;
    const { data: m } = await c.from("merchants").select("kakao_place_id").eq("id", merchantId).maybeSingle();
    const { data: p } = m ? await c.from("place_info").select("menu_items, drink_items, photos").eq("kakao_id", m.kakao_place_id).maybeSingle() : { data: null };
    // 판매 상품 사진(products.photos, docs/22)도 같은 폴더에 있다 — 빠뜨리면 30일 뒤 상품 사진이 사라진다
    const { data: prods } = await c.from("products").select("photos, sellers!inner(merchant_id)").eq("sellers.merchant_id", merchantId).limit(500);
    const productPhotos = ((prods ?? []) as unknown as { photos?: unknown }[]).flatMap((x) => (Array.isArray(x.photos) ? (x.photos as string[]).map(String) : []));
    // 대표 사진(photos)도 같은 폴더에 있다 — 표·대표 사진·상품 사진 어디에도 없는 것만 지운다
    const used = new Set([...menuImages(cleanMenuItems(p?.menu_items), cleanDrinkItems(p?.drink_items)), ...cleanStorePhotos(p?.photos), ...productPhotos].map((u) => u.slice(u.lastIndexOf("/") + 1)));
    const { data: files } = await c.storage.from(MENU_PHOTO_BUCKET).list(merchantId, { limit: 1000 });
    const old = (files ?? []).filter((x) => !used.has(x.name) && new Date(x.created_at ?? now).getTime() < cutoff).map((x) => `${merchantId}/${x.name}`);
    if (old.length) { await c.storage.from(MENU_PHOTO_BUCKET).remove(old); removed += old.length; }
  }
  return removed;
}
