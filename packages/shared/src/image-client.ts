/// <reference lib="dom" />
/**
 * 사진 업로드 전 줄이기(브라우저 전용) — 메뉴판 사진 읽기(어드민·파트너 앱 공용).
 * 긴 변 1,600px JPEG(품질 0.85)로 줄여 base64만 돌려준다. 보통 0.3~0.8MB — 서버 본문 한도(4.5MB) 안쪽, AI 이미지 토큰도 줄어든다.
 */
export const MENU_MAX_EDGE = 1600, MENU_MAX_FILES = 4;

export async function shrinkToJpeg(file: File, maxEdge = MENU_MAX_EDGE): Promise<{ type: "image/jpeg"; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { type: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}
