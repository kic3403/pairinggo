/**
 * 간편로그인 — 카카오 · 네이버 · 구글 (Auth.js v5).
 * Supabase Auth는 네이버를 지원하지 않아 세 곳을 모두 커버하는 Auth.js를 쓴다.
 *
 * 세션은 JWT(쿠키)에 담고, 우리 DB의 users 행 id를 함께 넣는다. 저장 목록 같은 데이터는 그 id로 붙인다.
 * 키가 없는 공급자는 목록에서 빠진다 — 하나만 등록해도 그것만 동작한다.
 *
 * 개인정보: 공급자 식별자·닉네임·이메일만 저장한다. 공개 전 개인정보처리방침과 수집 동의가 있어야 한다.
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Naver from "next-auth/providers/naver";
import { db } from "@/lib/db";

export type SocialProvider = "kakao" | "naver" | "google";
export const PROVIDER_LABEL: Record<SocialProvider, string> = { kakao: "카카오", naver: "네이버", google: "구글" };

const has = (a?: string, b?: string) => !!(a && b);
/** 환경변수가 있는 공급자만 노출 — 로그인 화면의 버튼도 이 목록을 따른다 */
export function enabledProviders(): SocialProvider[] {
  const out: SocialProvider[] = [];
  if (has(process.env.AUTH_KAKAO_ID, process.env.AUTH_KAKAO_SECRET)) out.push("kakao");
  if (has(process.env.AUTH_NAVER_ID, process.env.AUTH_NAVER_SECRET)) out.push("naver");
  if (has(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET)) out.push("google");
  return out;
}
export const authEnabled = () => !!process.env.AUTH_SECRET && enabledProviders().length > 0;

/** 로그인할 때 users 행을 만들거나 갱신하고 내부 id를 돌려준다 */
async function upsertUser(p: { provider: SocialProvider; uid: string; email?: string | null; name?: string | null; avatar?: string | null }) {
  const sb = db();
  if (!sb) return null;
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("users")
    .upsert(
      { provider: p.provider, provider_uid: p.uid, email: p.email ?? null, name: p.name ?? null, avatar_url: p.avatar ?? null, last_login_at: now },
      { onConflict: "provider,provider_uid" },
    )
    .select("id")
    .single();
  if (error) { console.error("[auth] users upsert 실패:", error.message); return null; }
  return data?.id as string | undefined ?? null;
}

const providers: NextAuthConfig["providers"] = [];
if (has(process.env.AUTH_KAKAO_ID, process.env.AUTH_KAKAO_SECRET)) providers.push(Kakao({ clientId: process.env.AUTH_KAKAO_ID, clientSecret: process.env.AUTH_KAKAO_SECRET }));
if (has(process.env.AUTH_NAVER_ID, process.env.AUTH_NAVER_SECRET)) providers.push(Naver({ clientId: process.env.AUTH_NAVER_ID, clientSecret: process.env.AUTH_NAVER_SECRET }));
if (has(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET)) providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // 최초 로그인 때만 account가 온다 — 이때 우리 DB에 붙인다
      if (account && profile) {
        const provider = account.provider as SocialProvider;
        const uid = String(account.providerAccountId ?? profile.sub ?? "");
        if (uid) {
          const id = await upsertUser({
            provider, uid,
            email: (profile.email as string | undefined) ?? token.email,
            name: (profile.name as string | undefined) ?? (token.name as string | undefined),
            avatar: (profile.picture as string | undefined) ?? (token.picture as string | undefined),
          });
          if (id) token.uid = id;
          token.provider = provider;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = String(token.uid);
      if (token.provider) (session.user as { provider?: string }).provider = String(token.provider);
      return session;
    },
  },
});
