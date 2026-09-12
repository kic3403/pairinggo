/**
 * POST /api/auth/reset — 세션 쿠키를 지운다(로그아웃). 사이트를 새로 열 때(탭의 첫 화면) 항상 로그아웃 상태로 시작하기 위해
 * SavedProvider가 첫 로드에 한 번 부른다. 사용자 결정(2026-09-12): "첫 화면은 무조건 로그아웃된 상태".
 * GET은 받지 않는다(링크만 눌러도 로그아웃되는 걸 막는다).
 * Auth.js의 signOut({redirect:false})은 라우트 핸들러 응답에 쿠키 삭제가 실리지 않아(실측) 쿠키를 직접 지운다.
 */
import { cookies } from "next/headers";
import { json, NO_CACHE } from "@/lib/http";

export const runtime = "nodejs";

/** Auth.js v5 세션 쿠키 이름 — http/https, 그리고 긴 토큰이 나뉘어 저장되는 조각(.0 .1 …) */
const NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

export async function POST(req: Request) {
  // 같은 사이트에서 온 요청만 — 다른 사이트가 우리 사용자를 로그아웃시키지 못하게
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.endsWith(`//${host}`)) return json(req, { ok: false }, { status: 403, headers: NO_CACHE });

  const jar = await cookies();
  let cleared = 0;
  for (const c of jar.getAll()) {
    if (NAMES.some((n) => c.name === n || c.name.startsWith(`${n}.`))) { jar.delete(c.name); cleared++; }
  }
  return json(req, { ok: true, cleared }, { headers: NO_CACHE });
}
