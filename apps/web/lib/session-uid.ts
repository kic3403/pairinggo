/**
 * 라우트 핸들러에서 로그인한 회원 id 읽기 — getToken으로만.
 * auth()는 응답에 세션 쿠키를 다시 써서 첫 화면 로그아웃(/api/auth/reset)과 경합한다(docs/13). /api/ratings와 같은 방식.
 */
import { getToken } from "next-auth/jwt";

export async function userIdOf(req: Request): Promise<string | null> {
  try {
    const secure = new URL(req.url).protocol === "https:";
    const t = await getToken({ req, secret: process.env.AUTH_SECRET ?? "", secureCookie: secure, salt: secure ? "__Secure-authjs.session-token" : "authjs.session-token" });
    return typeof t?.uid === "string" ? t.uid : null;
  } catch { return null; }
}

/** 같은 사이트에서 온 요청만(CSRF) — origin이 있으면 host와 맞아야 한다 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  return !(origin && host && !origin.endsWith(`//${host}`));
}
