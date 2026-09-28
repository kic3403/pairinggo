/**
 * 파트너 사업자등록증(2026-09-29, 0048) — 비공개 버킷 partner-docs. 파트너 앱이 브라우저에서 줄인 JPEG(base64)를 올리고,
 * 운영자 화면(web /admin/partners)만 10분짜리 서명 주소로 본다. 공개 주소는 만들지 않는다.
 */
import { randomBytes } from "node:crypto";
import { db } from "./db";

export const PARTNER_DOC_BUCKET = "partner-docs";
export const PARTNER_DOC_MAX = 2;
const MAX_BYTES = 2_000_000;
const need = () => { const c = db(); if (!c) throw new Error("DB 미설정"); return c; };

/** 사진 검사 — JPEG만, 2MB까지(브라우저가 긴 변 1,600px로 줄여 보낸다) */
export function partnerDocProblem(images: unknown): string | null {
  const arr = Array.isArray(images) ? images : [];
  if (!arr.length) return "사업자등록증 사진을 올려 주세요.";
  if (arr.length > PARTNER_DOC_MAX) return `사업자등록증 사진은 ${PARTNER_DOC_MAX}장까지예요.`;
  for (const x of arr) {
    const data = String((x as { data?: unknown })?.data ?? "");
    const buf = Buffer.from(data, "base64");
    if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) return "사업자등록증은 사진(JPG)으로 올려 주세요.";
    if (buf.length > MAX_BYTES) return "사진이 너무 커요 — 다시 찍어 올려 주세요.";
  }
  return null;
}

/** 한 폴더에 올리고 경로 목록을 돌려준다 */
export async function uploadPartnerDocs(folder: string, images: { data: string }[]): Promise<string[]> {
  const c = need();
  const paths: string[] = [];
  for (const img of images.slice(0, PARTNER_DOC_MAX)) {
    const buf = Buffer.from(String(img.data ?? ""), "base64");
    const path = `${folder}/${Date.now()}-${randomBytes(4).toString("hex")}.jpg`;
    const put = () => c.storage.from(PARTNER_DOC_BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: false });
    let { error } = await put();
    if (error && /not found|bucket/i.test(error.message)) {
      await c.storage.createBucket(PARTNER_DOC_BUCKET, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: ["image/jpeg"] }).catch(() => null);
      ({ error } = await put());
    }
    if (error) { await removePartnerDocs(paths); throw new Error("사업자등록증을 올리지 못했어요 — 잠시 뒤 다시 시도해 주세요"); }
    paths.push(path);
  }
  return paths;
}

export async function removePartnerDocs(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await need().storage.from(PARTNER_DOC_BUCKET).remove(paths).catch(() => null);
}

/** 이미 가입한 매장 — 사업자등록증 바꾸기(예전 사진은 지운다) */
export async function replaceMerchantBizDocs(merchantId: string, images: { data: string }[]): Promise<number> {
  const problem = partnerDocProblem(images);
  if (problem) throw new Error(problem);
  const c = need();
  const { data: cur } = await c.from("merchants").select("biz_doc_paths").eq("id", merchantId).maybeSingle();
  const paths = await uploadPartnerDocs(merchantId, images);
  const { error } = await c.from("merchants").update({ biz_doc_paths: paths, biz_doc_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", merchantId);
  if (error) { await removePartnerDocs(paths); throw new Error(error.message); }
  await removePartnerDocs(((cur?.biz_doc_paths as string[] | null) ?? []).filter((p) => !paths.includes(p)));
  return paths.length;
}

/** 운영자만 — 10분짜리 서명 주소(실패한 장은 null) */
export async function partnerDocUrls(paths: string[]): Promise<(string | null)[]> {
  const c = db();
  if (!c || !paths.length) return paths.map(() => null);
  return Promise.all(paths.map(async (p) => { const { data } = await c.storage.from(PARTNER_DOC_BUCKET).createSignedUrl(p, 600).catch(() => ({ data: null })); return data?.signedUrl ?? null; }));
}
