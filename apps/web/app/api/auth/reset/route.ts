/**
 * POST /api/auth/reset — 세션 쿠키를 지운다(로그아웃). 사이트를 새로 열 때(탭의 첫 화면) 항상 로그아웃 상태로 시작하기 위해
 * SavedProvider가 첫 로드에 한 번 부른다. 사용자 결정(2026-09-12): "첫 화면은 무조건 로그아웃된 상태".
 * GET은 받지 않는다(링크만 눌러도 로그아웃되는 걸 막는다).
 */
import { signOut } from "@/auth";
import { json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // 같은 사이트에서 온 요청만 — 다른 사이트가 우리 사용자를 로그아웃시키지 못하게
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.endsWith(`//${host}`)) return json(req, { ok: false }, { status: 403, headers: NO_CACHE });
  try { await signOut({ redirect: false }); } catch { /* 세션이 없으면 그대로 */ }
  return json(req, { ok: true }, { headers: NO_CACHE });
}
