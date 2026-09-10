/**
 * 운영 어드민 인증 (Phase 2.5) — ADMIN_PASSWORD 하나로 로그인, HMAC 서명 쿠키 7일.
 * Phase 4에서 Supabase Auth(역할)로 교체. 비밀번호가 설정되지 않으면 어드민 전체가 닫힌다.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const COOKIE = "pgo_admin";
const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";
export const adminEnabled = () => !!process.env.ADMIN_PASSWORD;

function sign(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }

export function issueToken(days = 7): string {
  const exp = Date.now() + days * 86400_000;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}
export function verifyToken(token?: string | null): boolean {
  if (!token || !adminEnabled()) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i), sig = token.slice(i + 1);
  const exp = Number(payload.split(".")[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expect = sign(payload);
  return sig.length === expect.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
}
export function checkPassword(pw: string): boolean {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real || pw.length !== real.length) return false;
  return timingSafeEqual(Buffer.from(pw), Buffer.from(real));
}
/** 서버 컴포넌트·라우트에서: 로그인 여부 */
export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return verifyToken(c.get(COOKIE)?.value);
}
/** 보호 페이지에서: 미로그인 → /admin/login */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
/** API 라우트에서: 미로그인 → 401 응답 (null이면 통과) */
export async function guardApi(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return new Response(JSON.stringify({ error: "로그인이 필요합니다" }), { status: 401, headers: { "Content-Type": "application/json" } });
}
