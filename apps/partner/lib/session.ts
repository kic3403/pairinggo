/**
 * 파트너 로그인 — 이메일+비밀번호(partner_users), HMAC 서명 쿠키 30일(매장 태블릿에 켜 두고 쓰는 앱이라 길게).
 * 페어링GO 손님 로그인(Auth.js)과 주소·쿠키가 달라 섞이지 않는다. 비밀번호를 바꾸거나 정지하면 pwv(비밀번호 해시 앞 8자)가 달라져 기존 쿠키가 끊긴다.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@pairinggo/server/db";

export const COOKIE = "pgo_partner";
const DAYS = 30;
const secret = () => process.env.PARTNER_AUTH_SECRET || "";
export const authConfigured = () => secret().length >= 16 && !!db();

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const pwv = (hash: string) => createHmac("sha256", secret()).update(hash).digest("base64url").slice(0, 8);

export function issueToken(userId: string, passwordHash: string): string {
  const payload = `${userId}.${Date.now() + DAYS * 86400_000}.${pwv(passwordHash)}`;
  return `${payload}.${sign(payload)}`;
}

function parseToken(token?: string | null): { userId: string; pw: string } | null {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, exp, pw, sig] = parts;
  if (!/^[0-9a-f-]{36}$/.test(userId) || !(Number(exp) > Date.now())) return null;
  const expect = sign(`${userId}.${exp}.${pw}`);
  return sig.length === expect.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? { userId, pw } : null;
}

export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: DAYS * 86400 };

export type PartnerUser = { id: string; email: string; name: string; phone: string };

/** 지금 로그인한 파트너(쿠키 서명 + DB의 비밀번호 버전까지 확인) */
export async function currentPartner(): Promise<PartnerUser | null> {
  const t = parseToken((await cookies()).get(COOKIE)?.value);
  const c = db();
  if (!t || !c) return null;
  const { data } = await c.from("partner_users").select("id, email, name, phone, password_hash").eq("id", t.userId).maybeSingle();
  if (!data || pwv(String(data.password_hash)) !== t.pw) return null;
  return { id: String(data.id), email: String(data.email), name: String(data.name), phone: String(data.phone) };
}

/** 보호 페이지: 로그인 안 했으면 /login */
export async function requirePartner(): Promise<PartnerUser> {
  const u = await currentPartner();
  if (!u) redirect("/login");
  return u;
}

/** API: 로그인 안 했으면 401 응답, 했으면 파트너 */
export async function partnerOr401(): Promise<PartnerUser | Response> {
  const u = await currentPartner();
  return u ?? Response.json({ error: "다시 로그인해 주세요" }, { status: 401 });
}
