/**
 * 비밀번호 해시 — Node 내장 scrypt. 외부 의존성 없이 쓴다.
 * 저장 형식: scrypt$N$r$p$salt(base64)$hash(base64)
 * 평문은 어디에도 저장하지 않고, 비교는 timingSafeEqual로 한다.
 */
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (pw: string | Buffer, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const N = 16384, r = 8, p = 1, LEN = 32;
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, LEN, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, rr, pp, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const key = await scrypt(pw.normalize("NFKC"), salt, expected.length, { N: Number(n), r: Number(rr), p: Number(pp), maxmem: MAXMEM });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch { return false; }
}

/** 가입 시 비밀번호 규칙 — 너무 짧거나 흔한 것만 막는다 */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (pw.length > 72) return "비밀번호가 너무 깁니다.";
  if (/^\d+$/.test(pw)) return "숫자로만 된 비밀번호는 쓸 수 없습니다.";
  if (/^(.)\1+$/.test(pw)) return "같은 문자만 반복할 수 없습니다.";
  return null;
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const emailLooksValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
