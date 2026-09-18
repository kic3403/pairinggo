/**
 * 메뉴판 사진 읽기 — 본체는 packages/server/menu-read(파트너 앱과 공용, 2026-09-19 옮김).
 * 어드민은 카탈로그를 여기서 넘겨 주고, 결과의 이름만 입력칸에 더한다(shared mergeMenuRead).
 */
import { readMenuImages as read, type MenuImageType, type MenuReadResult } from "@pairinggo/server/menu-read";
import { getCatalog } from "./catalog";

export { MENU_IMAGE_MAX_B64, MENU_IMAGE_TYPES, MENU_IMAGES_MAX, checkMenuImages, menuReadConfigured, menuReadError, type MenuImageType } from "@pairinggo/server/menu-read";

export async function readMenuImages(images: { type: MenuImageType; data: string }[]): Promise<MenuReadResult> {
  const c = await getCatalog();
  return read(images, { drinks: c.dataset.drinks.map((d) => d.name), foods: c.dataset.foods.map((f) => f.name) });
}
